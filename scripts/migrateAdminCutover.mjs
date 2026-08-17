#!/usr/bin/env node
/**
 * scripts/migrateAdminCutover.mjs — مهاجرت و کات‌اوورِ هدف‌دار (فاز ۷)
 *
 * برخلافِ scripts/auditAdminRbac.mjs که *همه‌ی* ادمین‌های legacy را به عضویت
 * تبدیل می‌کند، این اسکریپت دقیقاً یک تصمیمِ اعلام‌شده را اجرا می‌کند:
 *
 *   • فقط یک کاربر (با ایمیلِ مشخص) عضویتِ ادمین با دسترسیِ کامل می‌گیرد.
 *   • بقیه‌ی کاربرانی که `role: "admin"` دارند، نقشِ کسب‌وکاری‌شان نرمال می‌شود
 *     و هیچ عضویتی نمی‌گیرند.
 *
 * ── قاعده‌ی امنِ نرمال‌سازی ─────────────────────────────────────────────
 * `role` یک فیلدِ *کسب‌وکاری* است و «admin» رویش نشسته بود. پاک کردنش نباید
 * قابلیتِ دیگری را از بین ببرد:
 *
 *   کاربری که درخواستِ مربیگریِ approved *و* کدِ مربی دارد  →  "coach"
 *   بقیه                                                    →  "user"
 *
 * بدونِ این تفکیک، دو مربیِ فعال (با کد و کیف پول) به کاربر عادی تنزل
 * می‌کردند و جریان‌های مربیگری‌شان می‌شکست.
 *
 * ── ایمنی ────────────────────────────────────────────────────────────────
 *   • پیش‌فرض dry-run است؛ نوشتن فقط با `--apply`.
 *   • پیش از هر نوشتنی یک فایلِ بازگردانی (snapshot) ساخته می‌شود.
 *   • همه‌ی نوشتن‌ها در یک تراکنش‌اند؛ بدونِ پشتیبانیِ تراکنش، اجرا رد می‌شود.
 *   • عضویت با upsert روی `user` ساخته می‌شود → اجرای دوباره چیزی را تکرار
 *     نمی‌کند.
 *   • پس از اعمال، وضعیت دوباره خوانده و بررسی می‌شود.
 *
 * اجرا:
 *   node scripts/migrateAdminCutover.mjs
 *   node scripts/migrateAdminCutover.mjs --apply
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import mongoose from "mongoose";

import {
  SUPER_ADMIN_ROLE_NAME,
  SUPER_ADMIN_SYSTEM_KEY,
} from "../src/lib/permissions.js";
import { deriveDisplayName, deriveUsername } from "../src/lib/adminGuards.js";

/** تنها حسابی که عضویتِ ادمین می‌گیرد. */
const TARGET_EMAIL = "mosalehkamali@gmail.com";

const id = (value) => String(value);

/* ────────────────────────────────────────────────────────────────────────── */

async function supportsTransactions(connection) {
  try {
    const info = await connection.db.admin().command({ hello: 1 });
    return !!(info?.setName || info?.msg === "isdbgrid");
  } catch {
    return false;
  }
}

/** قاعده‌ی امنِ نرمال‌سازی — بالا مستند شده است. */
export function normalizedRoleFor(user) {
  const approvedCoach =
    user?.coachApplication?.status === "approved" && !!user?.coachCode;
  return approvedCoach ? "coach" : "user";
}

async function buildPlan(db) {
  const Users = db.collection("users");
  const Admins = db.collection("admins");
  const Roles = db.collection("adminroles");

  const blockers = [];
  const warnings = [];

  // ── هدف ───────────────────────────────────────────────────────────────
  const target = await Users.findOne(
    { email: TARGET_EMAIL },
    { collation: { locale: "en", strength: 2 } }
  );

  if (!target) {
    blockers.push(`کاربری با ایمیل ${TARGET_EMAIL} پیدا نشد.`);
  } else if (target.isBanned) {
    blockers.push(
      `کاربرِ هدف (${id(target._id)}) مسدود است؛ عضویتِ او قابل استفاده نخواهد بود.`
    );
  }

  const duplicateEmails = target
    ? await Users.countDocuments(
        { email: TARGET_EMAIL },
        { collation: { locale: "en", strength: 2 } }
      )
    : 0;
  if (duplicateEmails > 1) {
    blockers.push(
      `${duplicateEmails} کاربر با همین ایمیل وجود دارد؛ هدف مبهم است.`
    );
  }

  // ── نقشِ محافظت‌شده ────────────────────────────────────────────────────
  const roles = await Roles.find({}).toArray();
  const byKey = roles.filter((r) => r.systemKey === SUPER_ADMIN_SYSTEM_KEY);
  if (byKey.length > 1) {
    blockers.push(
      `چند نقش با systemKey="${SUPER_ADMIN_SYSTEM_KEY}" وجود دارد: ${byKey
        .map((r) => id(r._id))
        .join("، ")}`
    );
  }
  const superRole = byKey[0] || null;
  const roleAction = superRole ? "adopt" : "create";

  // ── عضویت‌های موجود ───────────────────────────────────────────────────
  const memberships = await Admins.find({}).toArray();
  const targetMembership = target
    ? memberships.find((m) => m.user && id(m.user) === id(target._id))
    : null;
  const foreignMemberships = memberships.filter(
    (m) => !target || !m.user || id(m.user) !== id(target._id)
  );
  if (foreignMemberships.length) {
    warnings.push(
      `${foreignMemberships.length} عضویتِ دیگر وجود دارد؛ این اسکریپت آن‌ها را دست نمی‌زند. برای «فقط یک ادمین» باید جداگانه تعیین تکلیف شوند.`
    );
  }

  // ── نرمال‌سازیِ بقیه ──────────────────────────────────────────────────
  const legacy = await Users.find({ role: "admin" }).toArray();
  const demotions = legacy
    .filter((u) => !target || id(u._id) !== id(target._id))
    .map((u) => ({
      _id: u._id,
      label: u.email || u.phone || id(u._id),
      from: "admin",
      to: normalizedRoleFor(u),
    }));

  return {
    target,
    superRole,
    roleAction,
    targetMembership,
    demotions,
    legacyCount: legacy.length,
    blockers,
    warnings,
  };
}

function printPlan(plan, apply) {
  console.log(`\n${apply ? "◆ حالت اعمال (--apply)" : "◇ حالت گزارش (dry-run)"}`);
  console.log("─".repeat(72));

  console.log(`کاربرانی که اکنون role="admin" دارند: ${plan.legacyCount}`);
  console.log(
    `نقشِ «${SUPER_ADMIN_ROLE_NAME}»: ${
      plan.roleAction === "create" ? "ساخته می‌شود" : `موجود (${id(plan.superRole._id)}) تثبیت می‌شود`
    }`
  );

  if (plan.target) {
    console.log(
      `\nادمینِ نهایی: ${deriveDisplayName(plan.target)} — ${plan.target.email} (${id(
        plan.target._id
      )})`
    );
    console.log(
      `  عضویت: ${plan.targetMembership ? "از قبل وجود دارد → تضمین می‌شود" : "ساخته می‌شود"}`
    );
    console.log(`  نقشِ کسب‌وکاریِ او دست نمی‌خورد (role="${plan.target.role}")`);
  }

  console.log(`\nنرمال‌سازیِ نقشِ کسب‌وکاری: ${plan.demotions.length} کاربر`);
  for (const d of plan.demotions) {
    console.log(`  ${d.label.padEnd(30)} ${d.from} → ${d.to}`);
  }

  for (const w of plan.warnings) console.log(`\n⚠ ${w}`);
  for (const b of plan.blockers) console.log(`\n⛔ ${b}`);
}

function writeRollback(plan) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(process.cwd(), `rbac-cutover-rollback-${stamp}.json`);

  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        note:
          "برای بازگردانی: نقش‌ها و عضویت‌های ساخته‌شده را با شناسه حذف کنید و " +
          "role هر کاربر را به مقدارِ previousRole برگردانید.",
        targetUser: plan.target ? id(plan.target._id) : null,
        existingSuperRoleId: plan.superRole ? id(plan.superRole._id) : null,
        existingTargetMembershipId: plan.targetMembership
          ? id(plan.targetMembership._id)
          : null,
        demotions: plan.demotions.map((d) => ({
          userId: id(d._id),
          previousRole: d.from,
          newRole: d.to,
        })),
      },
      null,
      2
    ),
    "utf8"
  );

  return file;
}

async function applyPlan(db, plan, session) {
  const Users = db.collection("users");
  const Admins = db.collection("admins");
  const Roles = db.collection("adminroles");
  const opts = session ? { session } : {};
  const now = new Date();

  // ۱) نقشِ محافظت‌شده
  let superRoleId = plan.superRole?._id || null;
  if (plan.roleAction === "create") {
    const res = await Roles.insertOne(
      {
        name: SUPER_ADMIN_ROLE_NAME,
        description: "دسترسی کامل به همه‌ی بخش‌های پنل (شامل بخش‌های آینده)",
        permissions: [],
        isSystem: true,
        isFullAccess: true,
        systemKey: SUPER_ADMIN_SYSTEM_KEY,
        createdAt: now,
        updatedAt: now,
      },
      opts
    );
    superRoleId = res.insertedId;
    console.log("✓ نقشِ دسترسی کامل ساخته شد.");
  } else {
    await Roles.updateOne(
      { _id: superRoleId },
      {
        $set: {
          isSystem: true,
          isFullAccess: true,
          systemKey: SUPER_ADMIN_SYSTEM_KEY,
          updatedAt: now,
        },
      },
      opts
    );
    console.log("✓ نقشِ محافظت‌شده‌ی موجود تثبیت شد.");
  }

  // ۲) تنها عضویت — upsert روی user، پس اجرای دوباره بی‌اثر است
  const taken = await Admins.distinct("username", {}, opts);
  await Admins.updateOne(
    { user: plan.target._id },
    {
      $setOnInsert: {
        user: plan.target._id,
        name: deriveDisplayName(plan.target),
        username: deriveUsername(plan.target, new Set(taken)),
        email: plan.target.email || "",
        title: "",
        permissionGrants: [],
        permissionDenials: [],
        permissions: [],
        activatedBy: null,
        revokedAt: null,
        revokedBy: null,
        revokeReason: "",
        createdBy: null,
        updatedBy: null,
        lastLoginAt: null,
        source: "migration",
        createdAt: now,
      },
      // نقش و فعال‌بودن حتی برای عضویتِ موجود هم تضمین می‌شوند: هدفِ اعلام‌شده
      // «این حساب دسترسیِ کامل دارد» است، نه «اگر از قبل نبود بساز».
      $set: {
        role: superRoleId,
        isActive: true,
        activatedAt: now,
        updatedAt: now,
      },
    },
    { ...opts, upsert: true }
  );
  console.log("✓ عضویتِ ادمینِ هدف با نقشِ دسترسی کامل تضمین شد.");

  // ۳) نرمال‌سازیِ نقشِ کسب‌وکاریِ بقیه
  for (const d of plan.demotions) {
    await Users.updateOne(
      { _id: d._id, role: "admin" },
      { $set: { role: d.to, updatedAt: now } },
      opts
    );
  }
  console.log(`✓ ${plan.demotions.length} کاربر از نقشِ legacy خارج شدند.`);
}

async function verify(db) {
  const Users = db.collection("users");
  const Admins = db.collection("admins");
  const Roles = db.collection("adminroles");

  const problems = [];

  const remainingLegacy = await Users.countDocuments({ role: "admin" });
  const target = await Users.findOne(
    { email: TARGET_EMAIL },
    { collation: { locale: "en", strength: 2 } }
  );

  const memberships = await Admins.find({}).toArray();
  const active = memberships.filter((m) => m.isActive);
  const superRole = await Roles.findOne({ systemKey: SUPER_ADMIN_SYSTEM_KEY });

  if (!superRole) problems.push("نقشِ محافظت‌شده وجود ندارد.");
  else if (!superRole.isFullAccess || !superRole.isSystem) {
    problems.push("نقشِ محافظت‌شده پرچم‌های لازم را ندارد.");
  }

  if (active.length !== 1) {
    problems.push(`تعدادِ عضویتِ فعال ${active.length} است، نه ۱.`);
  } else {
    const only = active[0];
    if (!only.user || id(only.user) !== id(target?._id)) {
      problems.push("تنها عضویتِ فعال به کاربرِ هدف متصل نیست.");
    }
    if (!superRole || id(only.role) !== id(superRole._id)) {
      problems.push("عضویتِ فعال نقشِ دسترسی کامل ندارد.");
    }
    if (target?.isBanned) problems.push("کاربرِ هدف مسدود است.");
  }

  console.log("\n── بررسیِ پس از اعمال ──────────────────────────────────");
  console.log(`کاربرانِ باقی‌مانده با role="admin": ${remainingLegacy}`);
  console.log(`عضویت‌ها: ${memberships.length} (فعال: ${active.length})`);
  console.log(`نقشِ محافظت‌شده: ${superRole ? id(superRole._id) : "—"}`);

  if (problems.length) {
    for (const p of problems) console.log(`⛔ ${p}`);
    return false;
  }
  console.log("✓ وضعیتِ نهایی همان چیزی است که باید باشد.");
  return true;
}

/* ────────────────────────────────────────────────────────────────────────── */

async function main() {
  const apply = process.argv.includes("--apply");

  await mongoose.connect(process.env.MONGODB_URI_TENADOR);
  const connection = mongoose.connection;
  const db = connection.db;

  try {
    const plan = await buildPlan(db);
    printPlan(plan, apply);

    if (plan.blockers.length) {
      console.log("\n◇ هیچ تغییری نوشته نشد. ⛔ مسدودکننده دارد.");
      process.exitCode = 1;
      return;
    }

    if (!apply) {
      console.log("\n◇ هیچ تغییری نوشته نشد. برای اعمال: --apply");
      return;
    }

    if (!(await supportsTransactions(connection))) {
      console.log(
        "\n⛔ این استقرار تراکنش ندارد؛ اجرای نیمه‌کاره ممکن است. اعمال متوقف شد."
      );
      process.exitCode = 1;
      return;
    }

    const rollbackFile = writeRollback(plan);
    console.log(`\n✓ فایلِ بازگردانی نوشته شد: ${rollbackFile}`);

    const session = await connection.startSession();
    try {
      await session.withTransaction(() => applyPlan(db, plan, session));
    } finally {
      await session.endSession();
    }

    const ok = await verify(db);
    if (!ok) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("خطا:", error);
    process.exit(1);
  });
}
