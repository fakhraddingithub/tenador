/**
 * tests/adminRbacTransactions.test.mjs
 *
 * تستِ همروندیِ *واقعی* روی یک replica set واقعی (MongoMemoryReplSet).
 *
 * چرا این فایل جدا از tests/adminRbac.test.mjs است: آن فایل عمداً خالص و
 * بدون I/O است و در چند میلی‌ثانیه اجرا می‌شود. اینجا mongod بالا می‌آید و
 * تراکنش‌های واقعی commit/abort می‌شوند.
 *
 * ⚠️ هیچ چیزی mock نمی‌شود: همان `withSuperAdminInvariant` ای که روت‌های
 * production صدا می‌زنند اینجا اجرا می‌شود. هدف، اثباتِ چیزی است که تستِ خالص
 * نمی‌تواند اثبات کند:
 *
 *   ۱) دو عملیاتِ مخربِ هم‌زمان هر دو commit نمی‌شوند (write skew بسته است)
 *   ۲) sentinel واقعاً نوشته می‌شود (باگِ قبلی: فیلد در اسکیما نبود و
 *      strict-mode آن را بی‌صدا حذف می‌کرد، پس هیچ تعارضی ساخته نمی‌شد)
 *   ۳) sentinelِ گم‌شده/بدشکل/تکراری fail-closed است
 *   ۴) نبودِ پشتیبانیِ تراکنش fail-closed است (روی یک mongodِ standaloneِ واقعی)
 *   ۵) مسیرِ مسدودسازیِ کاربر و مسیرهای غیرفعال‌سازی/تغییرنقش/لغوِ عضویت
 *      هیچ‌کدام نمی‌توانند ناوردا را دور بزنند
 *
 * اجرا: npm run test:admin-rbac-tx
 */

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";

import Admin from "../models/Admin.js";
import AdminRole from "../models/AdminRole.js";
import User from "../models/User.js";
import AdminActivity from "../models/AdminActivity.js";
import { SUPER_ADMIN_SYSTEM_KEY } from "../src/lib/permissions.js";
import { recordAdminActivity } from "../src/lib/adminActivity.js";
import {
  ConcurrentModificationError,
  InvariantSentinelError,
  SuperAdminInvariantError,
  TransactionsUnavailableError,
  saveWithSuperAdminInvariant,
  transactionsAvailable,
  withSuperAdminInvariant,
} from "../src/lib/superAdminInvariant.js";

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replSet.getUri(), { dbName: "rbac-tx" });
});

after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

beforeEach(async () => {
  await Promise.all([
    Admin.deleteMany({}),
    AdminRole.deleteMany({}),
    User.deleteMany({}),
    // هوکِ pre("deleteMany") عمداً خطا می‌دهد؛ برای پاک‌سازیِ تست مستقیم روی
    // درایور می‌رویم — همان چیزی که اپلیکیشن نمی‌تواند انجام دهد.
    AdminActivity.collection.deleteMany({}),
  ]);
});

/* ── کمکی‌ها ──────────────────────────────────────────────────────────── */

let seq = 0;

async function makeUser({ banned = false } = {}) {
  seq += 1;
  return User.create({
    provider: "local",
    name: `u${seq}`,
    phone: `0912000${String(seq).padStart(4, "0")}`,
    password: "x".repeat(16),
    isBanned: banned,
  });
}

async function makeSuperRole(overrides = {}) {
  return AdminRole.create({
    name: overrides.name || `دسترسی کامل ${(seq += 1)}`,
    systemKey: SUPER_ADMIN_SYSTEM_KEY,
    isSystem: true,
    isFullAccess: true,
    permissions: [],
    ...overrides,
  });
}

async function makeMembership(user, role) {
  seq += 1;
  return Admin.create({
    user: user._id,
    name: `admin${seq}`,
    username: `admin${seq}`,
    role: role._id,
    isActive: true,
  });
}

/** وضعیتِ واقعیِ دیتابیس — نه چیزی که تست حدس می‌زند. */
async function usableSuperCount(roleId) {
  const admins = await Admin.find({ role: roleId, isActive: true }).lean();
  if (!admins.length) return 0;
  const users = await User.find({
    _id: { $in: admins.map((a) => a.user).filter(Boolean) },
    isBanned: { $ne: true },
  }).lean();
  return users.length;
}

async function sentinelRevision(roleId) {
  const doc = await AdminRole.findById(roleId).select("+invariantRevision").lean();
  return doc?.invariantRevision ?? null;
}

/** یک تراکنش را عمداً باز نگه می‌دارد تا پنجره‌ی همروندی واقعی باشد. */
const hold = (ms) => new Promise((r) => setTimeout(r, ms));

/* ════════════════════════════════════════════════════════════════════════
 * ۱) sentinel واقعاً نوشته می‌شود
 * ══════════════════════════════════════════════════════════════════════ */

test("the sentinel field survives Mongoose strict mode and really increments", async () => {
  const role = await makeSuperRole();
  const user = await makeUser();
  await makeMembership(user, role);

  assert.equal(await sentinelRevision(role._id), 0);

  await withSuperAdminInvariant(async () => "noop");
  assert.equal(
    await sentinelRevision(role._id),
    1,
    "اگر این صفر بماند یعنی update دوباره بی‌صدا strip شده و هیچ تعارضی ساخته نمی‌شود"
  );

  await withSuperAdminInvariant(async () => "noop");
  assert.equal(await sentinelRevision(role._id), 2);
});

test("the mutation result is returned untouched", async () => {
  const role = await makeSuperRole();
  const user = await makeUser();
  const membership = await makeMembership(user, role);

  const returned = await withSuperAdminInvariant((session) =>
    Admin.findOneAndUpdate(
      { _id: membership._id },
      { $set: { title: "مدیر فروش" } },
      { new: true, session }
    ).lean()
  );

  assert.equal(returned.title, "مدیر فروش");
});

/* ════════════════════════════════════════════════════════════════════════
 * ۲) write skew — دو عملیاتِ مخربِ هم‌زمان
 * ══════════════════════════════════════════════════════════════════════ */

const revoke = (id) =>
  withSuperAdminInvariant(async (session) => {
    // تراکنش را باز نگه می‌دارد تا هر دو واقعاً هم‌زمان باز باشند.
    await hold(60);
    return Admin.findOneAndUpdate(
      { _id: id, isActive: true },
      { $set: { isActive: false, revokedAt: new Date() } },
      { new: true, session }
    ).lean();
  });

test("two concurrent revokes of two different super admins cannot both commit", async () => {
  const role = await makeSuperRole();
  const [u1, u2] = [await makeUser(), await makeUser()];
  const [a1, a2] = [await makeMembership(u1, role), await makeMembership(u2, role)];

  assert.equal(await usableSuperCount(role._id), 2);

  const results = await Promise.allSettled([revoke(a1._id), revoke(a2._id)]);

  const ok = results.filter((r) => r.status === "fulfilled");
  const failed = results.filter((r) => r.status === "rejected");

  assert.equal(ok.length, 1, "دقیقاً یکی باید commit شود");
  assert.equal(failed.length, 1);
  assert.ok(
    failed[0].reason instanceof SuperAdminInvariantError,
    `انتظار SuperAdminInvariantError بود، دریافت شد: ${failed[0].reason}`
  );

  assert.equal(
    await usableSuperCount(role._id),
    1,
    "حداقل یک سوپرادمینِ قابل‌استفاده باید باقی بماند"
  );
});

test("concurrent ban and revoke — two different code paths — still cannot both commit", async () => {
  const role = await makeSuperRole();
  const [u1, u2] = [await makeUser(), await makeUser()];
  await makeMembership(u1, role);
  const a2 = await makeMembership(u2, role);

  // مسیر ۱: مسدودکردنِ کاربرِ سوپرادمینِ اول (همان کاری که روتِ کاربران می‌کند)
  const ban = withSuperAdminInvariant(async (session) => {
    await hold(60);
    const doc = await User.findById(u1._id).session(session);
    doc.isBanned = true;
    return doc.save({ session });
  });

  // مسیر ۲: لغو عضویتِ سوپرادمینِ دوم
  const results = await Promise.allSettled([ban, revoke(a2._id)]);

  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(
    results.find((r) => r.status === "rejected").reason instanceof
      SuperAdminInvariantError
  );
  assert.equal(await usableSuperCount(role._id), 1);
});

test("ten concurrent revokes still leave exactly one usable super admin", async () => {
  const role = await makeSuperRole();
  const memberships = [];
  for (let i = 0; i < 10; i += 1) {
    memberships.push(await makeMembership(await makeUser(), role));
  }

  const results = await Promise.allSettled(
    memberships.map((m) => revoke(m._id))
  );

  assert.equal(results.filter((r) => r.status === "fulfilled").length, 9);
  assert.equal(await usableSuperCount(role._id), 1);
});

/* ════════════════════════════════════════════════════════════════════════
 * ۲.۵) retry-safety — همان الگویی که روت‌ها واقعاً استفاده می‌کنند
 *
 * WriteConflict روی sentinel عمدی است، پس retry مسیرِ *عادی* است نه استثنا.
 * اگر mutate روی سندی کار کند که بیرون از تراکنش تغییر داده شده، تلاشِ دوم
 * چیزی برای نوشتن ندارد و تراکنش «موفق» commit می‌شود بدون هیچ تغییری.
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * یک تراکنشِ رقیب که روی همان سند می‌نویسد و باز می‌ماند.
 *
 * این تنها راهِ *قطعی* برای وادار کردنِ withTransaction به retry است؛ مسابقه‌ی
 * زمانی ممکن است اتفاق نیفتد و تست را بی‌خاصیت کند.
 */
async function blockWrite(Model, id, patch) {
  const session = await mongoose.startSession();
  session.startTransaction();
  await Model.updateOne({ _id: id }, { $set: patch }, { session });
  return async () => {
    await session.commitTransaction();
    await session.endSession();
  };
}

test("a saved Mongoose document is clean, so a second save writes nothing", async () => {
  // مکانیزمِ خودِ باگ، بدون هیچ همروندی: اگر withTransaction بعد از یک
  // save()ِ موفق دوباره اجرا شود، تلاشِ دوم دلتایی ندارد و بی‌صدا هیچ
  // نمی‌نویسد — پس callback باید idempotent باشد، نه متکی به دلتای سند.
  const role = await makeSuperRole();
  const membership = await makeMembership(await makeUser(), role);

  const doc = await Admin.findById(membership._id);
  doc.isActive = false;
  await doc.save();

  // شبیه‌سازیِ rollbackِ تراکنش
  await Admin.updateOne({ _id: membership._id }, { $set: { isActive: true } });

  await doc.save(); // «تلاشِ دوم»

  assert.equal(
    (await Admin.findById(membership._id).lean()).isActive,
    true,
    "این باید true بماند — همین یعنی save()ِ دوم هیچ ننوشت"
  );
});

test("a forced retry re-applies the change instead of silently dropping it", async () => {
  const role = await makeSuperRole();
  const keep = await makeMembership(await makeUser(), role);
  const target = await makeMembership(await makeUser(), role);
  assert.ok(keep);
  assert.equal(await usableSuperCount(role._id), 2);

  const doc = await Admin.findById(target._id);
  doc.isActive = false;
  doc.revokedAt = new Date();

  // تراکنشِ رقیب همان سندِ هدف را قفل می‌کند → تلاشِ اول WriteConflict
  // می‌گیرد و withTransaction کل callback را دوباره اجرا می‌کند.
  const release = await blockWrite(Admin, target._id, { title: "قفل" });
  const pending = saveWithSuperAdminInvariant(doc);
  const timer = setTimeout(release, 250);

  await pending;
  clearTimeout(timer);

  const after = await Admin.findById(target._id).lean();
  assert.equal(
    after.isActive,
    false,
    "پس از retry باید واقعاً نوشته شده باشد، نه اینکه ۲۰۰ برگردد و هیچ تغییر نکند"
  );
  assert.equal(after.title, "قفل", "نوشته‌ی تراکنشِ رقیب نباید پاک شود");
  assert.equal(await usableSuperCount(role._id), 1);
});

test("the protected save is idempotent across re-runs, the old pattern is not", async () => {
  // ⚠️ محدودیتِ صادقانه: وقتی خودِ `save()` داخل تراکنش WriteConflict می‌گیرد،
  // سند «کثیف» می‌ماند و اجرای دوم درست کار می‌کند (تستِ بالا همین را نشان
  // می‌دهد). حالتِ خطرناک آن است که `save()` *موفق* شود و تراکنش بعداً
  // دوباره اجرا شود — مثلاً خطای گذرا هنگام commit، که withTransaction با
  // اجرای مجددِ کلِ callback به آن پاسخ می‌دهد. آن حالت را نمی‌توان از داخلِ
  // فرآیند تحمیل کرد، پس اینجا دقیقاً همان توالی بازسازی می‌شود:
  // «یک اجرای موفق → برگشتِ تراکنش → اجرای دوباره».
  const role = await makeSuperRole();
  await makeMembership(await makeUser(), role); // نگه‌دارنده‌ی ناوردا
  const target = await makeMembership(await makeUser(), role);

  /** برگرداندنِ سند به وضعیتِ پیش از تلاش — دقیقاً کاری که abort می‌کند. */
  const rollback = () =>
    Admin.collection.updateOne(
      { _id: target._id },
      { $set: { isActive: true, __v: 0 } }
    );

  // الگوی قدیمی — دو خرابی هم‌زمان:
  //   • سند تمیز شده، پس دلتایی برای نوشتن نمانده (modifiedPaths خالی)
  //   • __vِ درون‌حافظه‌ای از تلاشِ اول بالا رفته، ولی در دیتابیس برنگشته
  // روی Admin (optimisticConcurrency) نتیجه VersionError است → روت ۴۰۹
  // می‌دهد بدون اینکه هیچ‌کس هم‌زمان چیزی تغییر داده باشد. روی User که
  // optimisticConcurrency ندارد، همین حالت *بی‌صدا* هیچ نمی‌نویسد.
  const stale = await Admin.findById(target._id);
  stale.isActive = false;
  await withSuperAdminInvariant((session) => stale.save({ session }));
  await rollback();

  await assert.rejects(
    withSuperAdminInvariant((session) => stale.save({ session })),
    (err) => err.name === "VersionError" && err.modifiedPaths.length === 0
  );
  assert.equal(
    (await Admin.findById(target._id).lean()).isActive,
    true,
    "و هیچ چیزی هم نوشته نشد"
  );

  // الگوی جدید، همان توالی
  const doc = await Admin.findById(target._id);
  doc.isActive = false;
  await saveWithSuperAdminInvariant(doc);
  await rollback();
  await saveWithSuperAdminInvariant(doc);

  assert.equal(
    (await Admin.findById(target._id).lean()).isActive,
    false,
    "الگوی جدید باید در هر اجرا همان تغییر را دوباره اعمال کند"
  );
});

test("a document changed by someone else between read and save is rejected, not overwritten", async () => {
  const role = await makeSuperRole();
  const keep = await makeMembership(await makeUser(), role);
  const target = await makeMembership(await makeUser(), role);
  assert.ok(keep);

  const stale = await Admin.findById(target._id);
  stale.title = "از روی نسخه‌ی قدیمی";

  // کسِ دیگری همان سند را ذخیره می‌کند (__v بالا می‌رود).
  const fresh = await Admin.findById(target._id);
  fresh.title = "نسخه‌ی جدید";
  await fresh.save();

  await assert.rejects(
    saveWithSuperAdminInvariant(stale),
    ConcurrentModificationError
  );
  assert.equal((await Admin.findById(target._id).lean()).title, "نسخه‌ی جدید");
});

test("saving a document that vanished mid-flight fails closed", async () => {
  const role = await makeSuperRole();
  await makeMembership(await makeUser(), role);

  const doomed = await makeMembership(await makeUser(), role);
  const doc = await Admin.findById(doomed._id);
  doc.title = "x";
  await Admin.deleteOne({ _id: doomed._id });

  await assert.rejects(
    saveWithSuperAdminInvariant(doc),
    ConcurrentModificationError
  );
});

test("the protected save still enforces the invariant it wraps", async () => {
  const role = await makeSuperRole();
  const only = await makeMembership(await makeUser(), role);

  const doc = await Admin.findById(only._id);
  doc.isActive = false;

  await assert.rejects(
    saveWithSuperAdminInvariant(doc),
    SuperAdminInvariantError
  );
  assert.equal((await Admin.findById(only._id).lean()).isActive, true);
});

/* ════════════════════════════════════════════════════════════════════════
 * ۳) هر مسیرِ مخرب پوشش داده شده است
 * ══════════════════════════════════════════════════════════════════════ */

test("banning the last usable super admin is blocked and rolled back", async () => {
  const role = await makeSuperRole();
  const user = await makeUser();
  await makeMembership(user, role);

  await assert.rejects(
    withSuperAdminInvariant(async (session) => {
      const doc = await User.findById(user._id).session(session);
      doc.isBanned = true;
      return doc.save({ session });
    }),
    SuperAdminInvariantError
  );

  const after = await User.findById(user._id).lean();
  assert.equal(after.isBanned, false, "تراکنش باید کاملاً برگشت بخورد");
  assert.equal(await usableSuperCount(role._id), 1);
});

test("deactivating the last usable super admin is blocked and rolled back", async () => {
  const role = await makeSuperRole();
  const membership = await makeMembership(await makeUser(), role);

  await assert.rejects(
    withSuperAdminInvariant((session) =>
      Admin.findOneAndUpdate(
        { _id: membership._id },
        { $set: { isActive: false } },
        { session }
      )
    ),
    SuperAdminInvariantError
  );

  assert.equal((await Admin.findById(membership._id).lean()).isActive, true);
});

test("moving the last usable super admin to a weaker role is blocked", async () => {
  const role = await makeSuperRole();
  const weak = await AdminRole.create({ name: "پشتیبان", permissions: ["orders.view"] });
  const membership = await makeMembership(await makeUser(), role);

  await assert.rejects(
    withSuperAdminInvariant((session) =>
      Admin.findOneAndUpdate(
        { _id: membership._id },
        { $set: { role: weak._id } },
        { session }
      )
    ),
    SuperAdminInvariantError
  );

  assert.equal(
    String((await Admin.findById(membership._id).lean()).role),
    String(role._id)
  );
});

test("unlinking the last usable super admin from its user is blocked", async () => {
  const role = await makeSuperRole();
  const membership = await makeMembership(await makeUser(), role);

  await assert.rejects(
    withSuperAdminInvariant((session) =>
      Admin.findOneAndUpdate(
        { _id: membership._id },
        { $set: { user: null } },
        { session }
      )
    ),
    SuperAdminInvariantError
  );
});

test("a banned user never counts, so revoking the only unbanned super is blocked", async () => {
  const role = await makeSuperRole();
  const banned = await makeUser({ banned: true });
  const active = await makeUser();
  await makeMembership(banned, role);
  const liveMembership = await makeMembership(active, role);

  assert.equal(await usableSuperCount(role._id), 1);

  await assert.rejects(
    withSuperAdminInvariant((session) =>
      Admin.findOneAndUpdate(
        { _id: liveMembership._id },
        { $set: { isActive: false } },
        { session }
      )
    ),
    SuperAdminInvariantError
  );
});

/* ════════════════════════════════════════════════════════════════════════
 * ۴) sentinelِ گم‌شده / بدشکل / تکراری
 * ══════════════════════════════════════════════════════════════════════ */

test("a missing sentinel fails closed and writes nothing", async () => {
  const user = await makeUser();

  await assert.rejects(
    withSuperAdminInvariant(async (session) => {
      const doc = await User.findById(user._id).session(session);
      doc.isBanned = true;
      return doc.save({ session });
    }),
    InvariantSentinelError
  );

  assert.equal((await User.findById(user._id).lean()).isBanned, false);
});

test("a malformed sentinel — right key, wrong flags — fails closed", async () => {
  for (const broken of [
    { isSystem: false, isFullAccess: true },
    { isSystem: true, isFullAccess: false },
    { systemKey: "Super-Admin", isSystem: true, isFullAccess: true }, // حساس به حروف
    { systemKey: null, isSystem: true, isFullAccess: true },
  ]) {
    await AdminRole.deleteMany({});
    await AdminRole.create({ name: `نقش ${(seq += 1)}`, ...broken });

    await assert.rejects(
      withSuperAdminInvariant(async () => "x"),
      InvariantSentinelError,
      `این شکلِ نقش نباید sentinel شمرده شود: ${JSON.stringify(broken)}`
    );
  }
});

test("a second full-access role makes the count ambiguous and fails closed", async () => {
  await makeSuperRole();
  // فقط اسکریپتِ سیستمی می‌تواند isFullAccess بسازد؛ اگر شد، شمارش fail-open
  // می‌شد چون دارندگانِ نقشِ دوم شمرده نمی‌شوند.
  await AdminRole.create({ name: "دسترسی کامل دوم", isFullAccess: true });

  await assert.rejects(
    withSuperAdminInvariant(async () => "x"),
    InvariantSentinelError
  );
});

/* ════════════════════════════════════════════════════════════════════════
 * ۵) قاعده‌ی «هرگز از ≥۱ به ۰» — نه «همیشه ≥۱»
 * ══════════════════════════════════════════════════════════════════════ */

test("with zero usable super admins to begin with, ordinary work is not bricked", async () => {
  // وضعیتِ امروزِ دیتابیسِ production: نقشِ محافظت‌شده هست، عضویتِ لینک‌شده نیست.
  const role = await makeSuperRole();
  const ordinary = await makeUser();

  assert.equal(await usableSuperCount(role._id), 0);

  await withSuperAdminInvariant(async (session) => {
    const doc = await User.findById(ordinary._id).session(session);
    doc.isBanned = true;
    return doc.save({ session });
  });

  assert.equal((await User.findById(ordinary._id).lean()).isBanned, true);
});

test("once one usable super admin exists the invariant is permanent", async () => {
  const role = await makeSuperRole();
  const user = await makeUser();
  const membership = await makeMembership(user, role);

  assert.equal(await usableSuperCount(role._id), 1);

  // از ۱ به ۰ ممنوع است — به هر سه روش
  for (const patch of [
    { isActive: false },
    { role: null },
    { user: null },
  ]) {
    await assert.rejects(
      withSuperAdminInvariant((session) =>
        Admin.findOneAndUpdate({ _id: membership._id }, { $set: patch }, { session })
      ),
      SuperAdminInvariantError
    );
  }

  assert.equal(await usableSuperCount(role._id), 1);
});

/* ════════════════════════════════════════════════════════════════════════
 * ۶) وایرینگِ روت‌ها — تراکنش دور زدنی نباشد
 * ══════════════════════════════════════════════════════════════════════ */

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

test("every route that can destroy the last super admin routes through the helper", () => {
  const users = read("src/app/api/admin/users/[userId]/route.js");

  assert.match(
    users,
    /if\s*\(\s*valid\.values\.isBanned\s*!==\s*undefined\s*\)\s*\{\s*try\s*\{\s*await saveWithSuperAdminInvariant\(user\)/,
    "PATCH کاربر باید هر بدنه‌ی حاویِ isBanned را داخل تراکنشِ محافظت‌شده ذخیره کند"
  );
  assert.doesNotMatch(
    users,
    /Boolean\(\s*body\.isBanned\s*\)/,
    'Boolean("false") === true — این تبدیل نباید برگردد'
  );
  assert.doesNotMatch(
    users,
    /Number\([^)]*\)\s*\|\|\s*0/,
    "coerce کردنِ ورودیِ نامعتبر به صفر نباید برگردد"
  );
  assert.doesNotMatch(
    users,
    /validRoles\s*=\s*\[[^\]]*"admin"/,
    'نقشِ "admin" نباید از این روت قابل تنظیم باشد'
  );

  const admins = read("src/app/api/admin/admins/[id]/route.js");
  assert.match(admins, /await saveWithSuperAdminInvariant\(admin\)/);
  assert.match(admins, /withSuperAdminInvariant\(\(session\) =>\s*Admin\.findOneAndUpdate/);

  // ⚠️ الگوی retry-ناامن نباید برگردد: withTransaction روی WriteConflict
  // callback را دوباره اجرا می‌کند و save()ِ دوم روی سندِ تمیزشده هیچ
  // نمی‌نویسد (تستِ زیر همین را روی دیتابیس واقعی اثبات می‌کند).
  for (const [name, source] of [
    ["users", users],
    ["admins", admins],
  ]) {
    assert.doesNotMatch(
      source,
      /withSuperAdminInvariant\(\s*\(session\)\s*=>\s*\w+\.save\(\{\s*session\s*\}\)\s*\)/,
      `${name}: ذخیره‌ی سندِ ازپیش‌تغییریافته داخل تراکنش، در برابر retry امن نیست`
    );
  }
});

test("the helper never writes the old, schema-less sentinel field", () => {
  const source = read("src/lib/superAdminInvariant.js");
  // فقط *نوشتن* روی فیلدِ قدیمی ممنوع است؛ نامش در توضیحِ باگ آزاد است.
  assert.doesNotMatch(source, /\$set:\s*\{\s*invariantTouchedAt/);
  assert.match(source, /\$inc:\s*\{\s*invariantRevision:\s*1\s*\}/);
});

/* ════════════════════════════════════════════════════════════════════════
 * ۷) بدونِ پشتیبانیِ تراکنش — روی یک mongodِ standaloneِ واقعی
 *
 * آخرین تست است چون اتصالِ سراسری mongoose را جابه‌جا می‌کند.
 * ══════════════════════════════════════════════════════════════════════ */

test("a standalone deployment fails closed instead of running unprotected", async () => {
  await mongoose.disconnect();
  const standalone = await MongoMemoryServer.create();
  try {
    await mongoose.connect(standalone.getUri(), { dbName: "rbac-standalone" });

    assert.equal(await transactionsAvailable(), false);

    const role = await makeSuperRole();
    const user = await makeUser();
    await makeMembership(user, role);

    let touched = false;
    await assert.rejects(
      withSuperAdminInvariant(async () => {
        touched = true;
        return "should never run";
      }),
      TransactionsUnavailableError
    );

    assert.equal(touched, false, "mutate نباید حتی اجرا شود");
    assert.equal(await sentinelRevision(role._id), 0);
  } finally {
    await mongoose.disconnect();
    await standalone.stop();
    await mongoose.connect(replSet.getUri(), { dbName: "rbac-tx" });
  }
});

/* ───────────────────────────────────────────────────────────────────────────
 * فاز ۶ — دفترِ فعالیت: تغییرناپذیری روی دیتابیسِ واقعی
 *
 * ادعای «فقط‌افزودنی» فقط با اجرای واقعیِ همان هوک‌ها قابل اثبات است؛ تستِ
 * خالص نمی‌تواند نشان دهد که updateOne روی کالکشن شکست می‌خورد.
 * ─────────────────────────────────────────────────────────────────────────── */

async function makeActivity(overrides = {}) {
  return AdminActivity.create({
    action: "role.update",
    result: "success",
    ...overrides,
  });
}

test("an activity record cannot be edited once written", async () => {
  const record = await makeActivity({ reason: "اولیه" });

  record.reason = "دستکاری‌شده";
  await assert.rejects(record.save(), /فقط‌افزودنی/);

  // و مقدارِ روی دیسک عوض نشده است
  const fresh = await AdminActivity.findById(record._id).lean();
  assert.equal(fresh.reason, "اولیه");
});

test("every update and delete operation on the ledger throws", async () => {
  const record = await makeActivity();

  await assert.rejects(
    AdminActivity.updateOne({ _id: record._id }, { $set: { result: "denied" } }),
    /فقط‌افزودنی/
  );
  await assert.rejects(
    AdminActivity.updateMany({}, { $set: { result: "denied" } }),
    /فقط‌افزودنی/
  );
  await assert.rejects(
    AdminActivity.findOneAndUpdate({ _id: record._id }, { $set: { reason: "x" } }),
    /فقط‌افزودنی/
  );
  await assert.rejects(AdminActivity.deleteOne({ _id: record._id }), /فقط‌افزودنی/);
  await assert.rejects(AdminActivity.deleteMany({}), /فقط‌افزودنی/);
  await assert.rejects(
    AdminActivity.findOneAndDelete({ _id: record._id }),
    /فقط‌افزودنی/
  );

  // رکورد هنوز سرِ جایش است
  assert.equal(await AdminActivity.countDocuments({ _id: record._id }), 1);
});

test("an unknown field is rejected instead of being silently dropped", async () => {
  // strict:"throw" — رکوردِ ممیزیِ ناقصِ بی‌سروصدا بدتر از خطاست.
  await assert.rejects(makeActivity({ somethingElse: "x" }), /somethingElse|strict/i);
});

test("recording never throws into the caller, even when the write fails", async () => {
  // action نداریم → مدل required می‌گیرد. تابع باید false بدهد، نه throw.
  const ok = await recordAdminActivity({ action: "", result: "success" });
  assert.equal(ok, false);

  // و یک رکوردِ واقعاً نامعتبر هم فقط false می‌دهد
  const bad = await recordAdminActivity({ action: "x.y", result: "not-a-result" });
  assert.equal(bad, false);
  assert.equal(await AdminActivity.countDocuments({ action: "x.y" }), 0);
});

test("a real record keeps the actor snapshot after the membership is revoked", async () => {
  const user = await makeUser();
  const role = await makeSuperRole({ name: "نقشِ آزمایشی", isFullAccess: false, permissions: ["users.ban"], systemKey: undefined, isSystem: false });
  const membership = await makeMembership(user, role);

  const ctx = {
    user,
    membership: { ...membership.toObject(), username: membership.username },
    role,
    isFullAccess: false,
    permissions: ["users.ban"],
    source: "membership",
  };

  const written = await recordAdminActivity({
    ctx,
    action: "user.ban",
    permissions: ["users.ban"],
    result: "success",
    resource: { type: "User", id: user._id, label: "هدف" },
  });
  assert.equal(written, true);

  // عضویت لغو می‌شود — رکورد باید همچنان بگوید چه کسی و با چه نقشی
  await Admin.updateOne({ _id: membership._id }, { $set: { isActive: false } });

  const record = await AdminActivity.findOne({ action: "user.ban" }).lean();
  assert.equal(String(record.actorUser), String(user._id));
  assert.equal(String(record.actorAdmin), String(membership._id));
  assert.equal(record.actorSnapshot.roleName, "نقشِ آزمایشی");
  assert.equal(record.actorSnapshot.source, "membership");
  assert.equal(record.actorSnapshot.permissionCount, 1);
});

test("secrets never reach the ledger, even nested in metadata", async () => {
  await recordAdminActivity({
    action: "admin.update",
    result: "success",
    metadata: {
      password: "hunter2",
      accessToken: "abc",
      nested: { refresh_token: "xyz", note: "بی‌خطر" },
      certificateImage: "https://private/doc.pdf",
    },
  });

  const record = await AdminActivity.findOne({ action: "admin.update" }).lean();
  const serialized = JSON.stringify(record.metadata);

  for (const secret of ["hunter2", "abc", "xyz", "private/doc.pdf"]) {
    assert.ok(!serialized.includes(secret), `«${secret}» به دفتر نشت کرده`);
  }
  assert.equal(record.metadata.note ?? record.metadata.nested.note, "بی‌خطر");
});
