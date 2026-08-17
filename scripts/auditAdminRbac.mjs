/**
 * scripts/auditAdminRbac.mjs
 *
 * ممیزی و مهاجرتِ فاز ۱ بازطراحی RBAC.
 *
 * حالت امن (پیش‌فرض، فقط خواندن — هیچ نوشتنی انجام نمی‌شود):
 *   npm run audit:admin-rbac
 *
 * حالت اعمال (تنها با پرچم صریح):
 *   npm run migrate:admin-rbac        →  node scripts/auditAdminRbac.mjs --apply
 *
 * ── ترتیب کار: PREFLIGHT → (تصمیم) → WRITE ─────────────────────────────────
 * تمام بررسی‌ها *قبل از* هر نوشتنی انجام می‌شوند. اگر حتی یک مسدودکننده‌ی
 * بحرانی وجود داشته باشد، هیچ نوشتنی رخ نمی‌دهد (نه جزئی، نه کامل).
 *
 * مسدودکننده‌های بحرانی:
 *   • بیش از یک سند Admin برای یک کاربر (ایندکس یکتا بعداً شکست می‌خورد و
 *     مهاجرت را نیمه‌کاره رها می‌کرد)
 *   • ابهام/تعارض در نقشِ محافظت‌شده (چند کاندید، systemKey متعارض، یا نقشِ
 *     کاربرساخته‌ای که فقط *نامش* «دسترسی کامل» است)
 *   • صفر سوپرادمینِ واقعاً قابل‌استفاده پس از اعمال
 *
 * چه چیزی هرگز انجام نمی‌دهد:
 *   • تطبیق خودکار اسناد Admin بدون کاربر با کاربران بر اساس نام/ایمیل/نام‌کاربری
 *   • ارتقای یک نقشِ کاربرساخته به «دسترسی کامل» صرفاً به‌خاطر هم‌نام بودن
 *   • حدس زدنِ کلیدهای مبهم `events.*`
 *   • حذف هیچ سند Admin (تاریخچه‌ی ممیزی باید بماند)
 */

import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import {
  SUPER_ADMIN_ROLE_NAME,
  SUPER_ADMIN_SYSTEM_KEY,
  classifyPermissionKeys,
  isValidPermissionKey,
  migratePermissionKeys,
} from "../src/lib/permissions.js";
import { deriveDisplayName, deriveUsername } from "../src/lib/adminGuards.js";

const id = (value) => (value == null ? "" : String(value));

/* ────────────────────────────────────────────────────────────────────────────
 * هلپرهای خالص (بدون I/O) — قابل تست مستقیم
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * شکلِ فیلد `user` — دقیقاً همان‌طور که ایندکس یکتا آن را می‌بیند.
 *
 * partialFilterExpression: `{ user: { $type: "objectId" } }`
 * یعنی فقط ObjectIdِ *واقعیِ* BSON ایندکس می‌شود. اگر مقداری به‌اشتباه به‌صورت
 * رشته‌ی ۲۴ حرفی ذخیره شده باشد:
 *   • ایندکس نمی‌بیندش (پس یکتایی تضمین نمی‌شود)
 *   • کوئریِ `Admin.find({ user: ObjectId })` هم پیدایش نمی‌کند
 * یعنی سندی است که نه محافظت می‌شود نه کار می‌کند → باید مسدود و گزارش شود.
 */
export function describeUserRef(value) {
  if (value === null || value === undefined || value === "") {
    return { kind: "missing", key: null };
  }

  const isObjectId =
    typeof value === "object" &&
    (value._bsontype === "ObjectId" || value._bsontype === "ObjectID") &&
    typeof value.toHexString === "function";

  if (isObjectId) return { kind: "objectId", key: value.toHexString() };

  return { kind: "malformed", key: String(value), valueType: typeof value };
}

/**
 * دسته‌بندی اسناد Admin.
 *   linked     → user ایندکس‌پذیر و یکتا، و آن کاربر وجود دارد
 *   orphan     → user ایندکس‌پذیر و یکتا، ولی کاربر وجود ندارد
 *   unlinked   → user ندارد (سند legacy؛ هرگز به نشست map نمی‌شود)
 *   malformed  → user هست ولی ObjectId نیست (ایندکس نمی‌شود، resolve هم نمی‌شود)
 *   ambiguous  → چند سند Admin با یک user (نقض یک‌به‌یک)
 *
 * ⚠️ ترتیب مهم است: گروه‌بندی *قبل از* بررسیِ وجود کاربر انجام می‌شود.
 * در نسخه‌ی قبلی، اسنادِ یتیم پیش از گروه‌بندی کنار گذاشته می‌شدند، پس دو سند
 * Admin با یک ObjectIdِ *ناموجود* هرگز ambiguous تشخیص داده نمی‌شدند — در حالی
 * که ایندکس یکتا حتماً روی آن‌ها شکست می‌خورد. ایندکس به وجود User کاری ندارد؛
 * preflight هم نباید داشته باشد.
 */
export function classifyAdminRecords(admins, userIds) {
  const users = userIds instanceof Set ? userIds : new Set([...userIds].map(id));
  const byUser = new Map();
  const out = {
    linked: [],
    unlinked: [],
    orphan: [],
    ambiguous: [],
    malformed: [],
  };

  for (const admin of admins) {
    const ref = describeUserRef(admin.user);

    if (ref.kind === "missing") {
      out.unlinked.push(admin);
      continue;
    }
    if (ref.kind === "malformed") {
      out.malformed.push({ admin, ref });
      continue;
    }

    if (!byUser.has(ref.key)) byUser.set(ref.key, []);
    byUser.get(ref.key).push(admin);
  }

  for (const [userId, docs] of byUser) {
    const userExists = users.has(userId);
    if (docs.length > 1) {
      out.ambiguous.push({ userId, admins: docs, userExists });
      continue;
    }
    (userExists ? out.linked : out.orphan).push(docs[0]);
  }

  return out;
}

/** ممیزی کلیدهای یک مجموعه سند (نقش یا ادمین). */
export function auditPermissionKeys(entries) {
  const findings = [];
  for (const entry of entries) {
    const report = classifyPermissionKeys(entry.permissions || []);
    if (
      report.retired.length ||
      report.ambiguous.length ||
      report.unknown.length
    ) {
      findings.push({ ...entry, report });
    }
  }
  return findings;
}

// هویتِ عضویت (نام نمایشی و نام کاربری) حالا در src/lib/adminGuards.js است تا
// مهاجرت و روتِ ساختِ ادمین *یک* تعریف داشته باشند. اینجا فقط دوباره صادر
// می‌شود تا امضای عمومیِ این اسکریپت (و تست‌هایش) تغییری نکند.
export { deriveDisplayName, deriveUsername };

/**
 * تشخیصِ امنِ نقشِ محافظت‌شده.
 *
 * هویت فقط از روی `systemKey` یا پرچم‌های صریح `isSystem && isFullAccess`
 * خوانده می‌شود. یک نقشِ کاربرساخته که *فقط* نامش «دسترسی کامل» است هرگز
 * پذیرفته نمی‌شود — به‌جای آن یک مسدودکننده تولید می‌کند.
 */
export function resolveSuperRole(roles) {
  const blockers = [];

  const byKey = roles.filter((r) => r.systemKey === SUPER_ADMIN_SYSTEM_KEY);
  // ⚠️ `isFullAccess` به‌تنهایی کاندید نیست: یک نقشِ عادی که به هر دلیلی این
  // پرچم را گرفته باشد نباید خودکار تبدیل به نقشِ سیستمی شود. کاندیدِ پرچمی
  // فقط ترکیبِ صریحِ isSystem && isFullAccess است.
  const byFlags = roles.filter(
    (r) =>
      r.isSystem && r.isFullAccess && r.systemKey !== SUPER_ADMIN_SYSTEM_KEY
  );

  // نقشِ full-access ای که سیستمی علامت نخورده = ناهنجاریِ داده و دسترسی کاملِ
  // کنترل‌نشده؛ خودکار پذیرفته نمی‌شود و باید انسان تعیین تکلیف کند.
  for (const role of roles) {
    if (
      role.isFullAccess &&
      !role.isSystem &&
      role.systemKey !== SUPER_ADMIN_SYSTEM_KEY
    ) {
      blockers.push(
        `نقش «${role.name}» (${id(role._id)}) پرچم isFullAccess دارد ولی isSystem/systemKey ندارد — به‌صورت خودکار به نقشِ محافظت‌شده تبدیل نمی‌شود.`
      );
    }
  }

  if (byKey.length > 1) {
    blockers.push(
      `چند نقش با systemKey="${SUPER_ADMIN_SYSTEM_KEY}" وجود دارد: ${byKey
        .map((r) => id(r._id))
        .join("، ")} — باید دستی یکی شود.`
    );
  }

  const candidates = [...byKey, ...byFlags];
  if (candidates.length > 1) {
    blockers.push(
      `چند نقشِ «دسترسی کامل» کاندید است: ${candidates
        .map((r) => `${r.name} (${id(r._id)})`)
        .join("، ")} — انتخاب خودکار انجام نمی‌شود.`
    );
  }

  const role = candidates[0] || null;

  // هم‌نامیِ خطرناک: نقشی که نامش «دسترسی کامل» است ولی نقشِ محافظت‌شده نیست.
  const nameCollisions = roles.filter(
    (r) =>
      String(r.name || "").trim() === SUPER_ADMIN_ROLE_NAME &&
      id(r._id) !== id(role?._id)
  );
  if (nameCollisions.length) {
    blockers.push(
      `نقش‌های هم‌نام با «${SUPER_ADMIN_ROLE_NAME}» که نقشِ سیستمی نیستند: ${nameCollisions
        .map((r) => id(r._id))
        .join("، ")} — ارتقای خودکار بر اساس نام انجام نمی‌شود؛ نام را تغییر دهید یا نقش را دستی علامت بزنید.`
    );
  }

  let action = "create";
  if (role) {
    action =
      role.systemKey === SUPER_ADMIN_SYSTEM_KEY &&
      role.isSystem &&
      role.isFullAccess
        ? "noop"
        : "adopt";
  }

  return { role, action, blockers, nameCollisions };
}

/** آیا این کاربر می‌تواند واقعاً وارد پنل شود؟ (مسدود = غیرقابل‌استفاده) */
export function isUsableAdminUser(user) {
  return !!user && !user.isBanned;
}

/**
 * preflight روی *همه‌ی* systemKeyها — نه فقط super-admin.
 *
 * ایندکس یکتای partial روی `systemKey: {$type:"string"}` رشته‌ی خالی را هم
 * ایندکس می‌کند؛ اگر دو نقش systemKey تکراری یا خالی داشته باشند، ساخت ایندکس
 * شکست می‌خورد — و اگر آن را بعد از نوشتنِ داده بسازیم، مهاجرت نیمه‌کاره
 * می‌ماند. پس همین‌جا، قبل از هر نوشتنی، مسدود می‌کنیم.
 */
export function auditSystemKeys(roles) {
  const blockers = [];
  const seen = new Map();

  for (const role of roles) {
    const raw = role.systemKey;
    if (raw === null || raw === undefined) continue;

    if (typeof raw !== "string") {
      blockers.push(
        `نقش ${id(role._id)}: systemKey باید رشته باشد (مقدار فعلی: ${typeof raw}).`
      );
      continue;
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      blockers.push(
        `نقش ${id(role._id)}: systemKey رشته‌ی خالی است — ایندکس یکتا آن را ایندکس می‌کند و با نقش خالیِ بعدی تداخل می‌کند.`
      );
      continue;
    }
    if (trimmed !== raw) {
      blockers.push(
        `نقش ${id(role._id)}: systemKey فاصله‌ی ابتدا/انتها دارد ("${raw}").`
      );
    }

    if (!seen.has(trimmed)) seen.set(trimmed, []);
    seen.get(trimmed).push(id(role._id));
  }

  for (const [key, ids] of seen) {
    if (ids.length > 1) {
      blockers.push(`systemKey تکراری "${key}" در نقش‌های: ${ids.join("، ")}`);
    }
  }

  return blockers;
}

/**
 * کلیدهای مبهم/ناشناخته = مسدودکننده، نه هشدار.
 *
 * اگر با این کلیدها مهاجرت کنیم، در لحظه‌ی cutover (وقتی enforcement روشن
 * می‌شود) دسترسیِ متناظرشان *بی‌صدا* از بین می‌رود. باید انسان قبل از مهاجرت
 * تعیین تکلیف کند: `events.*` یعنی collections یا limitedEditions؟
 */
export function auditUnresolvedKeys({ roles, admins }) {
  const blockers = [];

  const scan = (label, keys) => {
    const report = classifyPermissionKeys(keys || []);
    if (report.ambiguous.length) {
      blockers.push(
        `${label}: کلید مبهم ${report.ambiguous
          .map((a) => `${a.key} (${a.candidates.join(" یا ")})`)
          .join("، ")} — باید دستی تعیین تکلیف شود.`
      );
    }
    if (report.unknown.length) {
      blockers.push(
        `${label}: کلید ناشناخته ${report.unknown.join("، ")} — باید دستی حذف یا اصلاح شود.`
      );
    }
  };

  for (const role of roles) {
    scan(`AdminRole «${role.name}» (${id(role._id)})`, role.permissions);
  }
  for (const admin of admins) {
    const label = `Admin ${admin.username} (${id(admin._id)})`;
    scan(`${label}.permissions`, admin.permissions);
    scan(`${label}.permissionGrants`, admin.permissionGrants);
    scan(`${label}.permissionDenials`, admin.permissionDenials);
  }

  return blockers;
}

/**
 * ساخت برنامه‌ی مهاجرت. تابعی خالص است: ورودی وضعیت فعلی، خروجی «چه چیزی
 * قرار است نوشته شود» + مسدودکننده‌ها.
 */
export function planMigration({ adminUsers, admins, roles, existingUserIds }) {
  // اسناد Admin ممکن است به کاربرانی وصل باشند که role !== "admin" دارند
  // (مثلاً یک مربی که ادمین هم هست). پس مجموعه‌ی «کاربرانِ موجود» جدا از
  // «کاربرانِ نقش‌ادمین» داده می‌شود، وگرنه یتیم‌ها تشخیص داده نمی‌شوند.
  const knownUserIds = new Set([
    ...adminUsers.map((u) => id(u._id)),
    ...(existingUserIds ? [...existingUserIds].map(id) : []),
  ]);

  const classified = classifyAdminRecords(admins, knownUserIds);
  const superRole = resolveSuperRole(roles);

  const blockers = [];
  const warnings = [];

  // ── مسدودکننده: عضویت تکراری (مستقل از وجود User) ────────────────────
  for (const dup of classified.ambiguous) {
    blockers.push(
      `user ${dup.userId}${dup.userExists ? "" : " (کاربرش وجود ندارد)"} چند سند Admin دارد (${dup.admins
        .map((a) => id(a._id))
        .join("، ")}) — ایندکس یکتا شکست می‌خورد؛ ابتدا دستی ادغام شود.`
    );
  }

  // ── مسدودکننده: user با نوع غیرObjectId ──────────────────────────────
  for (const entry of classified.malformed) {
    blockers.push(
      `Admin ${entry.admin.username} (${id(entry.admin._id)}): فیلد user از نوع ObjectId نیست (${entry.ref.valueType}: "${entry.ref.key}") — نه ایندکس یکتا آن را می‌بیند و نه به هیچ نشستی map می‌شود.`
    );
  }

  // ── مسدودکننده: ابهام نقشِ محافظت‌شده ─────────────────────────────────
  blockers.push(...superRole.blockers);

  // ── مسدودکننده: systemKeyهای تکراری/نامعتبر (همه‌شان، نه فقط super-admin) ──
  blockers.push(...auditSystemKeys(roles));

  // ── مسدودکننده: کلیدهای مبهم/ناشناخته (جلوگیری از silent privilege loss) ──
  blockers.push(...auditUnresolvedKeys({ roles, admins }));

  // ── هشدار (غیرمسدودکننده): اسناد بدون کاربر / یتیم ───────────────────
  for (const a of classified.unlinked) {
    warnings.push(
      `Admin بدون کاربر: ${a.username} (${id(a._id)}) — اتصال باید دستی انجام شود؛ تطبیق با نام/ایمیل انجام نمی‌شود.`
    );
  }
  for (const a of classified.orphan) {
    warnings.push(`Admin یتیم: ${a.username} (${id(a._id)}) → user=${id(a.user)}`);
  }

  // ── عضویت‌های لازم ───────────────────────────────────────────────────
  const membershipByUser = new Map(
    classified.linked.map((a) => [id(a.user), a])
  );
  const ambiguousUsers = new Set(classified.ambiguous.map((a) => a.userId));

  const takenUsernames = new Set(
    admins.map((a) => String(a.username || "").toLowerCase()).filter(Boolean)
  );

  const createMemberships = [];

  for (const user of adminUsers) {
    const uid = id(user._id);
    if (ambiguousUsers.has(uid)) continue; // مسدودکننده‌اش بالاتر ثبت شد
    if (membershipByUser.has(uid)) continue;

    const usable = isUsableAdminUser(user);
    const username = deriveUsername(user, takenUsernames);
    takenUsernames.add(username);

    // کاربر مسدود: عضویت *غیرفعال* ساخته می‌شود تا سابقه ثبت شود ولی با
    // رفعِ مسدودی، دسترسی خودبه‌خود برنگردد؛ فعال‌سازی باید آگاهانه باشد.
    createMemberships.push({
      user: user._id,
      userId: uid,
      name: deriveDisplayName(user),
      username,
      isActive: usable,
      staged: !usable,
    });

    if (!usable) {
      warnings.push(
        `کاربر مسدود ${uid} به‌صورت عضویتِ غیرفعال ثبت می‌شود (بدون اعطای دسترسی).`
      );
    }
  }

  // ── بازنویسی/حذفِ قطعیِ کلیدهای بازنشسته ──────────────────────────────
  // هم snapshot قدیمی ادمین‌ها، هم permissions نقش‌ها.
  const roleKeyMigrations = [];
  for (const role of roles) {
    const result = migratePermissionKeys(role.permissions || []);
    const changed =
      result.rewritten.length > 0 || result.dropped.length > 0;
    if (!changed) continue;
    roleKeyMigrations.push({
      roleId: id(role._id),
      name: role.name,
      // ⚠️ فقط کلیدهای معتبر برای persist برنامه‌ریزی می‌شوند. کلیدهای مبهم/
      // ناشناخته اصلاً به اینجا نمی‌رسند چون خودشان مسدودکننده‌اند و اجرای
      // apply را متوقف می‌کنند؛ پس هیچ‌گاه کلید نامعتبری نوشته نمی‌شود.
      permissions: result.permissions,
      rewritten: result.rewritten,
      dropped: result.dropped,
      ambiguous: result.ambiguous,
      unknown: result.unknown,
    });
  }

  const grantBackfills = [];
  for (const admin of [...classified.linked, ...classified.unlinked]) {
    const legacy = admin.permissions || [];
    const already = admin.permissionGrants || [];
    if (!legacy.length || already.length) continue;

    const result = migratePermissionKeys(legacy);
    grantBackfills.push({
      adminId: id(admin._id),
      username: admin.username,
      grants: result.permissions,
      rewritten: result.rewritten,
      dropped: result.dropped,
      ambiguous: result.ambiguous,
      unknown: result.unknown,
    });
  }

  // ── نگهبان: هرگز صفر سوپرادمینِ *قابل‌استفاده* ────────────────────────
  const superRoleId = superRole.role ? id(superRole.role._id) : null;
  const usableUserIds = new Set(
    adminUsers.filter(isUsableAdminUser).map((u) => id(u._id))
  );
  const existingActiveSupers = classified.linked.filter(
    (a) =>
      a.isActive &&
      superRoleId &&
      id(a.role) === superRoleId &&
      usableUserIds.has(id(a.user))
  ).length;
  const plannedActiveSupers = createMemberships.filter((m) => m.isActive).length;
  const projectedSuperAdmins = existingActiveSupers + plannedActiveSupers;

  if (projectedSuperAdmins === 0) {
    blockers.push(
      "پس از اعمال، هیچ سوپرادمینِ فعالِ قابل‌استفاده‌ای باقی نمی‌ماند — اعمال متوقف می‌شود."
    );
  }

  // ── ناوردا (defence in depth): هیچ کلید نامعتبری نباید برای نوشتن برنامه‌ریزی شود ──
  const plannedKeys = [
    ...roleKeyMigrations.flatMap((r) => r.permissions),
    ...grantBackfills.flatMap((b) => b.grants),
  ];
  const plannedInvalidKeys = [
    ...new Set(plannedKeys.filter((key) => !isValidPermissionKey(key))),
  ];
  if (plannedInvalidKeys.length) {
    blockers.push(
      `خطای داخلی برنامه‌ریزی: کلید نامعتبر برای نوشتن انتخاب شده — ${plannedInvalidKeys.join("، ")}`
    );
  }

  return {
    classified,
    superRole,
    roleAction: superRole.action,
    createMemberships,
    grantBackfills,
    roleKeyMigrations,
    projectedSuperAdmins,
    plannedInvalidKeys,
    blockers,
    warnings,
    canApply: blockers.length === 0,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * نوشتن — فقط پس از عبور از preflight
 * ترتیب امن + upsert تا اجرای نیمه‌کاره قابل ادامه و idempotent باشد.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * آیا این استقرار تراکنش دارد؟ (replica set یا mongos)
 * پیش از هر نوشتنی بررسی می‌شود تا اجرای نیمه‌کاره ممکن نباشد.
 */
async function supportsTransactions(connection) {
  try {
    const info = await connection.db.admin().command({ hello: 1 });
    return !!(info?.setName || info?.msg === "isdbgrid");
  } catch {
    return false;
  }
}

async function applyPlan({ plan, Admins, Roles, session }) {
  const now = new Date();
  const opts = session ? { session } : {};
  let superRoleId = plan.superRole.role ? plan.superRole.role._id : null;

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
    console.log("✓ نقش دسترسی کامل ساخته شد.");
  } else if (plan.roleAction === "adopt") {
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

  // upsert بر اساس user → اجرای دوباره/نیمه‌کاره چیزی را تکرار نمی‌کند
  for (const m of plan.createMemberships) {
    await Admins.updateOne(
      { user: m.user },
      {
        $setOnInsert: {
          user: m.user,
          name: m.name,
          username: m.username,
          email: "",
          title: "",
          role: superRoleId,
          permissionGrants: [],
          permissionDenials: [],
          permissions: [],
          isActive: m.isActive,
          activatedAt: m.isActive ? now : null,
          activatedBy: null,
          revokedAt: null,
          revokedBy: null,
          revokeReason: m.staged ? "کاربر در زمان مهاجرت مسدود بود" : "",
          createdBy: null,
          updatedBy: null,
          lastLoginAt: null,
          source: "migration",
          createdAt: now,
          updatedAt: now,
        },
      },
      { ...opts, upsert: true }
    );
  }
  console.log(`✓ ${plan.createMemberships.length} عضویت تضمین شد.`);

  for (const b of plan.grantBackfills) {
    // شرط permissionGrants خالی → idempotent (اجرای دوم چیزی را بازنویسی نمی‌کند)
    await Admins.updateOne(
      {
        _id: new mongoose.Types.ObjectId(b.adminId),
        $or: [
          { permissionGrants: { $exists: false } },
          { permissionGrants: { $size: 0 } },
        ],
      },
      { $set: { permissionGrants: b.grants, updatedAt: now } },
      opts
    );
  }
  console.log(`✓ ${plan.grantBackfills.length} snapshot به grants منتقل شد.`);

  for (const r of plan.roleKeyMigrations) {
    await Roles.updateOne(
      { _id: new mongoose.Types.ObjectId(r.roleId) },
      { $set: { permissions: r.permissions, updatedAt: now } },
      opts
    );
  }
  console.log(`✓ ${plan.roleKeyMigrations.length} نقش با کلیدهای به‌روز ذخیره شد.`);
}

/* ────────────────────────────────────────────────────────────────────────────
 * اجرا
 * ──────────────────────────────────────────────────────────────────────────── */

async function run() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // متغیرهای محیطی از خود runtime می‌آیند
  }

  const uri = process.env.MONGODB_URI_TENADOR;
  const apply = process.argv.includes("--apply");

  if (!uri) {
    console.error("✗ MONGODB_URI_TENADOR تعریف نشده است.");
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const Admins = db.collection("admins");
  const Roles = db.collection("adminroles");
  const Users = db.collection("users");

  const [adminUsers, admins, roles] = await Promise.all([
    Users.find({ role: "admin" })
      .project({ name: 1, lastName: 1, phone: 1, email: 1, isBanned: 1 })
      .toArray(),
    Admins.find({}).toArray(),
    Roles.find({}).toArray(),
  ]);

  // کدام کاربرانِ ارجاع‌شده در اسناد Admin واقعاً وجود دارند؟ (تشخیص یتیم)
  const referenced = admins.map((a) => a.user).filter(Boolean);
  const existing = referenced.length
    ? await Users.find({ _id: { $in: referenced } })
        .project({ _id: 1 })
        .toArray()
    : [];
  const existingUserIds = new Set(existing.map((u) => id(u._id)));

  const plan = planMigration({ adminUsers, admins, roles, existingUserIds });
  const { classified } = plan;

  console.log(`\n${apply ? "◆ حالت اعمال (--apply)" : "◇ حالت گزارش (dry-run)"}`);
  console.log("──────────────────────────────────────────────");
  console.log(`کاربران با User.role="admin" : ${adminUsers.length}`);
  console.log(
    `  • قابل‌استفاده (مسدود نیست) : ${adminUsers.filter(isUsableAdminUser).length}`
  );
  console.log(`اسناد Admin                  : ${admins.length}`);
  console.log(`  • متصل                     : ${classified.linked.length}`);
  console.log(`  • بدون کاربر (legacy)      : ${classified.unlinked.length}`);
  console.log(`  • یتیم (کاربر حذف شده)     : ${classified.orphan.length}`);
  console.log(`  • user غیرObjectId         : ${classified.malformed.length}`);
  console.log(`  • مبهم (چند سند برای یک user): ${classified.ambiguous.length}`);

  // ── ممیزی کلیدها ────────────────────────────────────────────────────
  const findings = [
    ...auditPermissionKeys(
      roles.map((r) => ({
        kind: "AdminRole",
        label: r.name,
        _id: id(r._id),
        permissions: r.permissions,
      }))
    ),
    ...auditPermissionKeys(
      admins.flatMap((a) => [
        {
          kind: "Admin.permissions",
          label: a.username,
          _id: id(a._id),
          permissions: a.permissions,
        },
        {
          kind: "Admin.permissionGrants",
          label: a.username,
          _id: id(a._id),
          permissions: a.permissionGrants,
        },
        {
          kind: "Admin.permissionDenials",
          label: a.username,
          _id: id(a._id),
          permissions: a.permissionDenials,
        },
      ])
    ),
  ];

  console.log(`\nکلیدهای دسترسیِ نیازمند رسیدگی: ${findings.length} سند`);
  for (const f of findings) {
    const parts = [];
    if (f.report.retired.length)
      parts.push(
        `بازنشسته: ${f.report.retired
          .map((r) =>
            r.action === "rewrite"
              ? `${r.key} → ${r.replacement.join("+")}`
              : `${r.key} → حذف`
          )
          .join("، ")}`
      );
    if (f.report.ambiguous.length)
      parts.push(
        `مبهم (⛔ مسدودکننده): ${f.report.ambiguous.map((r) => r.key).join("، ")}`
      );
    if (f.report.unknown.length)
      parts.push(`ناشناخته (⛔ مسدودکننده): ${f.report.unknown.join("، ")}`);
    console.log(`  • [${f.kind}] ${f.label} (${f._id}) — ${parts.join(" | ")}`);
  }

  // ── برنامه ──────────────────────────────────────────────────────────
  const roleActionText = {
    create: "ساخته می‌شود",
    adopt: "نقشِ محافظت‌شده‌ی موجود تثبیت می‌شود (systemKey + پرچم‌ها)",
    noop: "موجود و درست است",
  };

  console.log("\nبرنامه:");
  console.log(`  • نقشِ سوپرادمین: ${roleActionText[plan.roleAction]}`);
  console.log(`  • عضویت‌های جدید: ${plan.createMemberships.length}`);
  for (const m of plan.createMemberships) {
    console.log(
      `    ↳ ${m.name} (user=${m.userId}) → ${m.username}` +
        (m.staged ? "  [غیرفعال — کاربر مسدود]" : "")
    );
  }
  console.log(`  • بازنویسی کلیدهای نقش‌ها: ${plan.roleKeyMigrations.length}`);
  for (const r of plan.roleKeyMigrations) {
    const bits = [
      ...r.rewritten.map((x) => `${x.from}→${x.to.join("+")}`),
      ...r.dropped.map((x) => `${x.key}→حذف`),
    ];
    console.log(`    ↳ ${r.name} (${r.roleId}): ${bits.join("، ")}`);
    console.log(`        نتیجه‌ی نهایی: ${r.permissions.length} کلید معتبر`);
  }
  console.log(`  • انتقال snapshot به permissionGrants: ${plan.grantBackfills.length}`);
  for (const b of plan.grantBackfills) {
    const bits = [
      ...b.rewritten.map((x) => `${x.from}→${x.to.join("+")}`),
      ...b.dropped.map((x) => `${x.key}→حذف (${x.reason})`),
      ...b.ambiguous.map((x) => `${x.key}→⛔ مسدودکننده`),
      ...b.unknown.map((x) => `${x}→⛔ مسدودکننده`),
    ];
    console.log(
      `    ↳ ${b.username} (${b.adminId}): ${b.grants.length} کلید` +
        (bits.length ? ` — ${bits.join("، ")}` : "")
    );
  }
  console.log(`  • سوپرادمینِ فعالِ قابل‌استفاده پس از اعمال: ${plan.projectedSuperAdmins}`);

  for (const w of plan.warnings) console.log(`  ℹ ${w}`);
  for (const b of plan.blockers) console.log(`  ⛔ ${b}`);

  if (!apply) {
    console.log(
      `\n◇ هیچ تغییری نوشته نشد.${
        plan.canApply
          ? " برای اعمال: npm run migrate:admin-rbac"
          : " ⛔ مسدودکننده دارد؛ اعمال ممکن نیست."
      }\n`
    );
    await mongoose.disconnect();
    return;
  }

  if (!plan.canApply) {
    console.error(
      `\n⛔ اعمال متوقف شد: ${plan.blockers.length} مسدودکننده‌ی بحرانی. هیچ نوشتنی انجام نشد.\n`
    );
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  // ── گام ۱: تراکنش باید در دسترس باشد؛ در غیر این صورت قبل از هر نوشتنی abort ──
  // fallbackِ خودکار به حالت بدون تراکنش عمداً حذف شد: یک شکستِ میانی، پایگاه
  // داده را در حالت نیمه‌مهاجرت رها می‌کند و بدترین حالت برای RBAC است.
  if (!(await supportsTransactions(mongoose.connection))) {
    console.error(
      "\n⛔ این استقرار MongoDB تراکنش پشتیبانی نمی‌کند (standalone).\n" +
        "   مهاجرت متوقف شد و هیچ داده‌ای نوشته نشد.\n" +
        "   روی replica set یا MongoDB Atlas اجرا کنید (همان چیزی که production استفاده می‌کند).\n"
    );
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  // ── گام ۲: ایندکس‌های یکتا *قبل از* نوشتن داده ────────────────────────
  // ساخت ایندکس داخل تراکنش ممکن نیست؛ اگر بعد از نوشتن داده ساخته شود و به‌خاطر
  // داده‌ی تکراری شکست بخورد، مهاجرت نیمه‌کاره می‌ماند. preflight تضمین کرده
  // تکراری وجود ندارد، پس اینجا باید موفق شود — و اگر نشد، هنوز چیزی ننوشته‌ایم.
  // این ایندکس‌ها هم‌زمان تضمینِ همروندی‌اند: دو اجرای موازی نمی‌توانند دو
  // عضویت یا دو نقشِ سیستمی بسازند.
  try {
    await Admins.createIndex(
      { user: 1 },
      {
        unique: true,
        partialFilterExpression: { user: { $type: "objectId" } },
        name: "admin_user_unique",
      }
    );
    await Roles.createIndex(
      { systemKey: 1 },
      {
        unique: true,
        partialFilterExpression: { systemKey: { $type: "string" } },
        name: "adminrole_systemkey_unique",
      }
    );
    console.log("✓ ایندکس‌های یکتا پیش از نوشتنِ داده تضمین شدند.");
  } catch (error) {
    console.error(
      `\n⛔ ساخت ایندکس یکتا شکست خورد — هیچ داده‌ای نوشته نشد:\n   ${error.message}\n`
    );
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  // ── گام ۳: نوشتنِ داده، فقط داخل تراکنش ──────────────────────────────
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() =>
      applyPlan({ plan, Admins, Roles, session })
    );
    console.log("✓ همه‌ی تغییرات در یک تراکنش اعمال شد.\n");
  } finally {
    await session.endSession();
  }

  await mongoose.disconnect();
}

// فقط هنگام اجرای مستقیم — تا تست‌ها بتوانند هلپرهای خالص را import کنند.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(async (error) => {
    console.error("✗ خطا:", error);
    process.exitCode = 1;
    await mongoose.disconnect().catch(() => {});
  });
}
