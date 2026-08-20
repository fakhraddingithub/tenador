import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { buildSearchFilter } from "../src/lib/search.js";
import { ACCEPTED, buildCoverage } from "../scripts/rbacCoverage.mjs";
import { ACTIVITY_RESULTS } from "../models/AdminActivity.js";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_RESULT_LABELS,
  activityCategory,
  activityLabel,
} from "../src/lib/activityLabels.js";
import {
  REDACTED,
  clientIpFrom,
  diffDocuments,
  isSecretField,
  redact,
} from "../src/lib/adminActivity.js";

import {
  ADMIN_ROUTE_ANY_MODE,
  ADMIN_ROUTE_PERMISSIONS,
  ADMIN_TAB_PERMISSIONS,
  AMBIGUOUS_PERMISSIONS,
  PERMISSION_MODULES,
  PERMISSION_SECTIONS,
  PROTECTED_ROLE_FIELDS,
  RETIRED_PERMISSIONS,
  SUPER_ADMIN_ROLE_NAME,
  SUPER_ADMIN_SYSTEM_KEY,
  canAccessAdminRoute,
  classifyPermissionKeys,
  computeEffectivePermissions,
  getAllPermissionKeys,
  getVisibleSections,
  hasPermission,
  isProtectedRole,
  matchAdminRoute,
  migratePermissionKeys,
  normalizePermissions,
  pruneUnsatisfiedDependencies,
  sanitizePermissions,
  stripProtectedRoleFields,
  validatePermissionKeys,
} from "../src/lib/permissions.js";

import {
  MAX_REVOKE_REASON_LENGTH,
  applyAdminStatusTransition,
  assertNoPrivilegeEscalation,
  assertRoleAssignable,
  assertRoleModifiable,
  canManageAdmin,
  canModifyRole,
  countUsableSuperAdmins,
  decideGateOutcome,
  decideMembershipAccess,
  deriveDisplayName,
  interpretRevokeOutcome,
  validateOptionalText,
  validateStatusPayload,
  validateUserPatchPayload,
} from "../src/lib/adminGuards.js";

import {
  auditSystemKeys,
  auditUnresolvedKeys,
  classifyAdminRecords,
  describeUserRef,
  deriveUsername,
  isUsableAdminUser,
  planMigration,
  resolveSuperRole,
} from "../scripts/auditAdminRbac.mjs";

import {
  ADMIN_API_PERMISSIONS,
  PUBLIC_ADMIN_API_PERMISSIONS,
  SITE_SETTING_OWNERS,
  constrainReadFilterToPermissions,
  filterNotificationPayload,
  isBranch,
  resolveAdminPatchPermissions,
  resolveArticlePatchPermissions,
  resolvePagePutPermissions,
  resolveSiteSettingPermission,
  resolveUserPatchPermissions,
} from "../src/lib/apiPermissions.js";



import mongoose from "mongoose";

/** ObjectIdِ واقعی — تا تست دقیقاً همان چیزی را ببیند که partial index می‌بیند. */
const objectId = () => new mongoose.Types.ObjectId();

/* ── یکپارچگی رجیستری ─────────────────────────────────────────────────── */

test("registry keys are unique, well formed and module keys do not collide", () => {
  const keys = getAllPermissionKeys();
  assert.equal(new Set(keys).size, keys.length, "کلید تکراری در رجیستری");
  for (const key of keys) {
    assert.match(key, /^[a-zA-Z]+\.[a-zA-Z]+$/, `کلید بدشکل: ${key}`);
  }

  const moduleKeys = PERMISSION_MODULES.map((m) => m.key);
  assert.equal(new Set(moduleKeys).size, moduleKeys.length, "کلید ماژول تکراری");

  const sectionKeys = PERMISSION_SECTIONS.map((s) => s.key);
  assert.equal(new Set(sectionKeys).size, sectionKeys.length, "کلید بخش تکراری");
});

test("every module keeps the flat UI contract and belongs to a section", () => {
  for (const mod of PERMISSION_MODULES) {
    assert.ok(mod.title, `${mod.key} عنوان ندارد`);
    assert.ok(mod.section, `${mod.key} بخش ندارد`);
    assert.ok(mod.permissions.length > 0, `${mod.key} اکشن ندارد`);
    for (const perm of mod.permissions) {
      // UI موجود کلید کامل را از mod.key + perm.key می‌سازد
      assert.equal(perm.fullKey, `${mod.key}.${perm.key}`);
      assert.ok(perm.title, `${perm.fullKey} عنوان ندارد`);
    }
  }
});

test("declared dependencies always point at existing keys", () => {
  const all = new Set(getAllPermissionKeys());
  for (const mod of PERMISSION_MODULES) {
    for (const perm of mod.permissions) {
      for (const dep of perm.requires) {
        assert.ok(all.has(dep), `${perm.fullKey} به کلید ناموجود ${dep} وابسته است`);
        assert.notEqual(dep, perm.fullKey, "وابستگی به خود");
      }
    }
  }
});

test("retired keys are gone and their rewrite targets exist", () => {
  const all = new Set(getAllPermissionKeys());
  for (const [key, entry] of Object.entries(RETIRED_PERMISSIONS)) {
    assert.ok(!all.has(key), `${key} باید بازنشسته باشد`);
    assert.ok(["rewrite", "drop"].includes(entry.action), `${key} action نامعتبر`);
    assert.ok(entry.reason, `${key} دلیل ندارد`);
    if (entry.action === "rewrite") {
      assert.ok(entry.replacement.length > 0, `${key} جایگزین ندارد`);
      for (const target of entry.replacement) {
        assert.ok(all.has(target), `جایگزین ${target} در رجیستری نیست`);
      }
    } else {
      assert.deepEqual(entry.replacement, [], `${key} نباید جایگزین داشته باشد`);
    }
  }
  for (const key of Object.keys(AMBIGUOUS_PERMISSIONS)) {
    assert.ok(!all.has(key), `${key} باید مبهم/بازنشسته باشد`);
  }
});

test("the invented inventory/warehouse concept is fully gone", () => {
  const moduleKeys = PERMISSION_MODULES.map((m) => m.key);
  assert.ok(!moduleKeys.includes("inventory"));
  assert.ok(!moduleKeys.includes("warehouse"));

  // نه در کلیدها و نه در متن‌های نمایشی نباید «انبار» به‌عنوان یک بخش ظاهر شود
  const surfaces = PERMISSION_MODULES.flatMap((m) => [
    m.key,
    m.title,
    m.description,
    ...m.permissions.map((p) => p.title),
  ]).join(" ");
  assert.ok(!/warehouse/i.test(surfaces), "واژه warehouse نباید بماند");
  assert.ok(!surfaces.includes("انبار") || surfaces.includes("رهگیری"), "«انبار» نباید بخشِ مستقل باشد");

  const tracking = PERMISSION_MODULES.find((m) => m.key === "orderTracking");
  assert.ok(tracking, "ماژول رهگیری اقلام سفارش وجود ندارد");
  assert.equal(tracking.section, "orders");
});

test("inventory.* is dropped, never guessed into orderTracking", () => {
  for (const key of ["inventory.view", "inventory.create", "inventory.edit"]) {
    assert.equal(RETIRED_PERMISSIONS[key].action, "drop");
  }
  const result = migratePermissionKeys(["inventory.view", "inventory.edit"]);
  assert.deepEqual(result.permissions, []);
  assert.equal(result.dropped.length, 2);
  assert.equal(result.rewritten.length, 0);
});

test("home management is split per real page, not one generic edit", () => {
  const keys = new Set(getAllPermissionKeys());
  for (const key of [
    "homeSlider.edit",
    "homeBanners.edit",
    "homeProductSliders.edit",
    "homeRolandGarros.edit",
    "homeFeaturedArticles.edit",
  ]) {
    assert.ok(keys.has(key), `${key} تعریف نشده`);
  }
  assert.ok(!keys.has("home.edit"), "home.edit باید بازنشسته باشد");

  const migrated = migratePermissionKeys(["home.edit"]);
  assert.equal(migrated.permissions.length, 5);
  assert.deepEqual(migrated.rewritten, [
    { from: "home.edit", to: RETIRED_PERMISSIONS["home.edit"].replacement },
  ]);
});

test("finance is split per real capability and site-settings has one owner per key", () => {
  const keys = new Set(getAllPermissionKeys());
  for (const key of [
    "analytics.view",
    "installments.view",
    "discounts.view",
    "bankAccount.edit",
    "exchangeRate.edit",
    "financingSettings.edit",
    "reviewCredit.edit",
  ]) {
    assert.ok(keys.has(key), `${key} تعریف نشده`);
  }
  // هیچ meta-permission عمومیِ مالی وجود ندارد
  assert.ok(!keys.has("finance.view"), "finance.view نباید کلید معتبر باشد");
  assert.ok(!keys.has("finance.manage"), "finance.manage نباید کلید معتبر باشد");
  assert.equal(PERMISSION_MODULES.find((m) => m.key === "finance"), undefined);

  // هیچ ماژولی مالکیتِ کلیِ /api/admin/site-settings را ادعا نکند
  const generic = PERMISSION_MODULES.filter((m) =>
    m.api.includes("/api/admin/site-settings")
  );
  assert.deepEqual(generic, [], "site-settings باید با ?key=... تفکیک شود");

  const owners = PERMISSION_MODULES.flatMap((m) =>
    m.api.filter((a) => a.startsWith("/api/admin/site-settings?"))
  );
  assert.equal(new Set(owners).size, owners.length, "مالکیت تکراری روی یک setting key");
});

test("the finance hub opens from any one real child capability, never a meta key", () => {
  const required = ADMIN_ROUTE_PERMISSIONS["/p-admin/financial"];
  assert.deepEqual(required.sort(), [
    "analytics.view",
    "bankAccount.view",
    "discounts.view",
    "exchangeRate.view",
    "financingSettings.view",
    "installments.view",
    "reviewCredit.view",
  ]);
  assert.ok(ADMIN_ROUTE_ANY_MODE.has("/p-admin/financial"));

  // یک قابلیت فرزند کافی است
  for (const key of required) {
    assert.equal(
      canAccessAdminRoute([key], "/p-admin/financial"),
      true,
      `${key} باید هاب را باز کند`
    );
  }

  // ولی دسترسیِ نامرتبط نه
  for (const unrelated of ["products.view", "orders.view", "tickets.view"]) {
    assert.equal(
      canAccessAdminRoute([unrelated], "/p-admin/financial"),
      false,
      `${unrelated} نباید هاب مالی را باز کند`
    );
  }
  assert.equal(canAccessAdminRoute([], "/p-admin/financial"), false);
});

test("legacy finance.* keys are ambiguous blockers, not silent drops", () => {
  for (const key of ["finance.view", "finance.manage"]) {
    assert.ok(AMBIGUOUS_PERMISSIONS[key], `${key} باید مبهم باشد`);
    assert.ok(!RETIRED_PERMISSIONS[key], `${key} نباید drop شود`);
    assert.ok(AMBIGUOUS_PERMISSIONS[key].candidates.length > 1);

    const migrated = migratePermissionKeys([key]);
    assert.deepEqual(migrated.permissions, [], "نباید حدس زده شود");
    assert.deepEqual(migrated.ambiguous.map((a) => a.key), [key]);
  }

  const plan = planMigration({
    adminUsers: [{ _id: objectId(), name: "علی" }],
    admins: [],
    roles: [{ _id: objectId(), name: "مالی", permissions: ["finance.view"] }],
    existingUserIds: new Set(),
  });
  assert.equal(plan.canApply, false);
  assert.ok(plan.blockers.some((b) => b.includes("finance.view")));
});

test("collections and limited editions are distinct; events.* stays ambiguous", () => {
  const collections = PERMISSION_MODULES.find((m) => m.key === "collections");
  const limited = PERMISSION_MODULES.find((m) => m.key === "limitedEditions");
  assert.ok(collections && limited);
  assert.notEqual(collections.section, limited.section);
  assert.equal(PERMISSION_MODULES.find((m) => m.key === "events"), undefined);

  const migrated = migratePermissionKeys(["events.edit"]);
  assert.deepEqual(migrated.permissions, [], "کلید مبهم نباید map شود");
  assert.deepEqual(migrated.ambiguous.map((a) => a.key), ["events.edit"]);
});

test("only verified AI actions exist — no fabricated usage/cost permission", () => {
  const ai = PERMISSION_MODULES.find((m) => m.key === "ai");
  assert.deepEqual(
    ai.permissions.map((p) => p.key).sort(),
    ["athletePrompt", "productDraft"]
  );
  assert.ok(!getAllPermissionKeys().includes("ai.viewUsage"));
});

/* ── نگاشت روت‌ها با فایل‌سیستم واقعی ─────────────────────────────────────
 * تطبیقِ دوطرفه‌ی manifest ↔ فایل‌سیستم در فاز ۴ به
 * «every admin page has a manifest entry and every entry has a page»
 * منتقل شد: همان بررسی، ولی با کنار گذاشتنِ صفحه‌ی ۴۰۳ (که عمداً بدونِ نگاشت
 * است) و بدون شمارشِ سختِ ۸۱ که با هر صفحه‌ی جدید بی‌دلیل قرمز می‌شد.
 * ──────────────────────────────────────────────────────────────────────── */

test("route mappings only reference valid permission keys", () => {
  const all = new Set(getAllPermissionKeys());
  for (const [route, keys] of [
    ...Object.entries(ADMIN_ROUTE_PERMISSIONS),
    ...Object.entries(ADMIN_TAB_PERMISSIONS),
  ]) {
    assert.ok(keys.length > 0, `${route} کلید ندارد`);
    for (const key of keys) {
      assert.ok(all.has(key), `${route} به کلید نامعتبر ${key} اشاره دارد`);
    }
  }
});

test("unmapped routes fail closed and hub routes use any-mode", () => {
  assert.equal(canAccessAdminRoute(getAllPermissionKeys(), "/p-admin/nope"), false);
  assert.equal(canAccessAdminRoute(["dashboard.view"], "/p-admin"), true);

  // هابِ پشتیبانی با یکی از سه کلید باز می‌شود
  assert.ok(ADMIN_ROUTE_ANY_MODE.has("/p-admin/support"));
  assert.equal(canAccessAdminRoute(["comments.view"], "/p-admin/support"), true);
  // ولی صفحه‌ی دو‌کلیدی هر دو را می‌خواهد
  assert.equal(
    canAccessAdminRoute(
      ["categories.view"],
      "/p-admin/admin-categories/category-products/[categoryId]"
    ),
    false
  );
});

/* ── تطبیق‌دهنده با URLهای واقعی ──────────────────────────────────────── */

test("real dynamic URLs match their pattern — the regression that was reported", () => {
  const oid1 = "507f1f77bcf86cd799439011";

  const match = matchAdminRoute(`/p-admin/admin-orders/${oid1}`);
  assert.equal(match.pattern, "/p-admin/admin-orders/[orderId]");
  assert.deepEqual(match.params, { orderId: oid1 });
  assert.equal(canAccessAdminRoute(["orders.view"], `/p-admin/admin-orders/${oid1}`), true);
  assert.equal(canAccessAdminRoute(["products.view"], `/p-admin/admin-orders/${oid1}`), false);
});

test("every dynamic pattern resolves from a concrete URL", () => {
  const concrete = (pattern) =>
    pattern
      .split("/")
      .map((seg, i) => (/^\[.+\]$/.test(seg) ? `507f1f77bcf86cd7994390${10 + i}` : seg))
      .join("/");

  const dynamic = Object.keys(ADMIN_ROUTE_PERMISSIONS).filter((p) =>
    p.includes("[")
  );
  assert.ok(dynamic.length >= 20, "الگوهای داینامیک کم شمرده شدند");

  for (const pattern of dynamic) {
    const url = concrete(pattern);
    const match = matchAdminRoute(url);
    assert.ok(match, `${url} هیچ الگویی را match نکرد`);
    assert.equal(match.ambiguous, false, `${url} مبهم شد`);
    assert.equal(match.pattern, pattern, `${url} به الگوی اشتباه رفت`);
    assert.equal(
      canAccessAdminRoute(ADMIN_ROUTE_PERMISSIONS[pattern], url),
      true,
      `${url} با کلیدهای خودش باز نشد`
    );
  }
});

test("static segments beat dynamic ones, exactly like Next.js", () => {
  assert.equal(
    matchAdminRoute("/p-admin/admin-brands/add").pattern,
    "/p-admin/admin-brands/add"
  );
  assert.equal(
    matchAdminRoute("/p-admin/admin-brands/507f1f77bcf86cd799439011").pattern,
    "/p-admin/admin-brands/[brandId]"
  );
  assert.equal(
    matchAdminRoute("/p-admin/admin-brands/507f1f77bcf86cd799439011/add-serie").pattern,
    "/p-admin/admin-brands/[brandId]/add-serie"
  );
  assert.equal(
    matchAdminRoute("/p-admin/admin-brands/aaa/bbb").pattern,
    "/p-admin/admin-brands/[brandId]/[serieId]"
  );
  assert.equal(
    matchAdminRoute("/p-admin/users/admins").pattern,
    "/p-admin/users/admins"
  );
  assert.equal(
    matchAdminRoute("/p-admin/users/507f1f77bcf86cd799439011").pattern,
    "/p-admin/users/[userId]"
  );
});

test("trailing slashes, duplicate slashes, encoding and absolute URLs normalize", () => {
  const expected = "/p-admin/admin-orders/[orderId]";
  for (const url of [
    "/p-admin/admin-orders/abc",
    "/p-admin/admin-orders/abc/",
    "/p-admin//admin-orders//abc",
    "https://shop.example.com/p-admin/admin-orders/abc",
  ]) {
    assert.equal(matchAdminRoute(url)?.pattern, expected, url);
  }

  // percent-encoding واقعی (نام کاربر فارسی در مسیر)
  const encoded = matchAdminRoute("/p-admin/users/%D8%B9%D9%84%DB%8C");
  assert.equal(encoded.pattern, "/p-admin/users/[userId]");
  assert.equal(encoded.params.userId, "علی");

  // encoding خراب → fail closed
  assert.equal(matchAdminRoute("/p-admin/users/%E0%A4%A"), null);
  assert.equal(matchAdminRoute(""), null);
  assert.equal(matchAdminRoute(null), null);
});

test("query tab is order-independent and tolerates extra params", () => {
  const base = "/p-admin/support";
  assert.equal(matchAdminRoute(`${base}?tab=comments`).tab, "comments");
  assert.deepEqual(matchAdminRoute(`${base}?tab=comments`).permissions, [
    "comments.view",
  ]);

  // ترتیب و پارامترهای اضافه نباید اثری داشته باشند
  for (const url of [
    `${base}?tab=comments&page=2`,
    `${base}?page=2&tab=comments`,
    `${base}?utm_source=x&tab=comments&sort=desc`,
  ]) {
    assert.equal(canAccessAdminRoute(["comments.view"], url), true, url);
    assert.equal(canAccessAdminRoute(["tickets.view"], url), false, url);
  }

  // تبِ مشخص حالت any را نمی‌گیرد: کلید همان تب لازم است
  assert.equal(matchAdminRoute(`${base}?tab=tickets`).mode, "all");

  const pages = matchAdminRoute("/p-admin/admin-pages?tab=home");
  assert.deepEqual(pages.permissions, ["home.view"]);
});

test("an explicit unknown tab fails closed instead of falling back to the hub", () => {
  // رگرسیون: fallback به کلیدهای پایه باعث می‌شد کاربرِ فقط-comments با
  // `?tab=zzz` وارد شود، چون کامپوننت برای مقدار نامعتبر به tickets می‌رود.
  const match = matchAdminRoute("/p-admin/support?tab=zzz");
  assert.equal(match.unknownTab, true);
  assert.equal(match.tab, null);
  assert.deepEqual(match.permissions, []);

  assert.equal(canAccessAdminRoute(["comments.view"], "/p-admin/support?tab=zzz"), false);
  assert.equal(canAccessAdminRoute(getAllPermissionKeys(), "/p-admin/support?tab=zzz"), false);
  assert.equal(
    canAccessAdminRoute(getAllPermissionKeys(), "/p-admin/admin-pages?tab=nope"),
    false
  );

  // نبودِ tab همچنان هاب است
  assert.equal(matchAdminRoute("/p-admin/support").unknownTab, false);
  assert.equal(canAccessAdminRoute(["comments.view"], "/p-admin/support"), true);
});

test("duplicate tab params fail closed", () => {
  const match = matchAdminRoute("/p-admin/support?tab=comments&tab=tickets");
  assert.equal(match.duplicateTab, true);
  assert.deepEqual(match.permissions, []);
  assert.equal(
    canAccessAdminRoute(getAllPermissionKeys(), "/p-admin/support?tab=comments&tab=tickets"),
    false
  );
  // حتی تکرارِ یک مقدار هم مبهم است و حدس زده نمی‌شود
  assert.equal(
    canAccessAdminRoute(["comments.view"], "/p-admin/support?tab=comments&tab=comments"),
    false
  );
});

test("the site-pages hub opens from either real capability, tabs stay exact", () => {
  const base = "/p-admin/admin-pages";
  assert.deepEqual(ADMIN_ROUTE_PERMISSIONS[base], ["home.view", "pages.view"]);
  assert.ok(ADMIN_ROUTE_ANY_MODE.has(base));

  // هرکدام از دو قابلیت به‌تنهایی کافی است
  assert.equal(canAccessAdminRoute(["home.view"], base), true);
  assert.equal(canAccessAdminRoute(["pages.view"], base), true);
  // هیچ‌کدام → رد
  assert.equal(canAccessAdminRoute(["products.view"], base), false);
  assert.equal(canAccessAdminRoute([], base), false);

  // تبِ صریح دقیق می‌ماند و از حالت any ارث نمی‌برد
  assert.equal(canAccessAdminRoute(["home.view"], `${base}?tab=home`), true);
  assert.equal(canAccessAdminRoute(["home.view"], `${base}?tab=content`), false);
  assert.equal(canAccessAdminRoute(["pages.view"], `${base}?tab=content`), true);
  assert.equal(canAccessAdminRoute(["pages.view"], `${base}?tab=home`), false);

  // تبِ ناشناخته و تکراری → fail-closed
  assert.equal(canAccessAdminRoute(getAllPermissionKeys(), `${base}?tab=zzz`), false);
  assert.equal(matchAdminRoute(`${base}?tab=zzz`).unknownTab, true);
  assert.equal(
    canAccessAdminRoute(getAllPermissionKeys(), `${base}?tab=home&tab=content`),
    false
  );
  assert.equal(matchAdminRoute(`${base}?tab=home&tab=content`).duplicateTab, true);
});

test("a stray tab param on a tab-less route is simply ignored", () => {
  const match = matchAdminRoute("/p-admin/admin-orders/507f1f77bcf86cd799439011?tab=zzz");
  assert.equal(match.unknownTab, false);
  assert.equal(match.duplicateTab, false);
  assert.deepEqual(match.permissions, ["orders.view"]);
  assert.equal(
    canAccessAdminRoute(["orders.view"], "/p-admin/admin-orders/abc?tab=zzz"),
    true
  );
});

test("truly equally specific patterns are ambiguous and fail closed", () => {
  // ابهام واقعی فقط وقتی رخ می‌دهد که دو الگو ماسکِ یکسان و segmentهای ثابتِ
  // یکسان داشته باشند و تنها در *نام* پارامتر فرق کنند — خطای رایج هنگام
  // افزودن روت جدید (مثل [userId] در کنار [id]).
  const manifest = {
    "/p-admin/users/[userId]": ["users.view"],
    "/p-admin/users/[id]": ["orders.view"],
  };
  const tie = matchAdminRoute("/p-admin/users/507f1f77bcf86cd799439011", manifest);
  assert.equal(tie.ambiguous, true);
  assert.equal(tie.patterns.length, 2);
  assert.equal(
    canAccessAdminRoute(getAllPermissionKeys(), "/p-admin/users/x"),
    true,
    "manifest واقعی نباید تحت تأثیر manifest تزریقی باشد"
  );

  // ترتیب ثابتِ متفاوت ابهام نیست — امتیاز lexicographic قطعی است
  const ordered = {
    "/p-admin/x/[a]": ["orders.view"],
    "/p-admin/[b]/y": ["products.view"],
  };
  assert.equal(matchAdminRoute("/p-admin/x/y", ordered).pattern, "/p-admin/x/[a]");
});

test("the real manifest cannot produce an ambiguous match", () => {
  // ۱) هیچ URLِ نمونه‌ای از خودِ الگوها مبهم نمی‌شود
  for (const pattern of Object.keys(ADMIN_ROUTE_PERMISSIONS)) {
    const url = pattern.replace(/\[[^\]]+\]/g, "sample");
    const match = matchAdminRoute(url);
    assert.ok(match, `${url} match نشد`);
    assert.notEqual(match.ambiguous, true, `${url} مبهم است`);
  }

  // ۲) و ساختاراً: هیچ دو الگویی «شکلِ» یکسان (ماسک + ثابت‌ها) ندارند،
  //    که تنها حالتِ ممکنِ ابهام است. این تست از افزودن روتِ مبهم جلوگیری می‌کند.
  const shapes = new Map();
  for (const pattern of Object.keys(ADMIN_ROUTE_PERMISSIONS)) {
    const shape = pattern
      .split("/")
      .filter(Boolean)
      .map((seg) => (/^\[.+\]$/.test(seg) ? "*" : seg))
      .join("/");
    if (!shapes.has(shape)) shapes.set(shape, []);
    shapes.get(shape).push(pattern);
  }
  for (const [shape, patterns] of shapes) {
    assert.equal(patterns.length, 1, `شکلِ تکراری «${shape}»: ${patterns.join(" ⇄ ")}`);
  }
});

/* ── محاسبه‌ی دسترسی مؤثر ─────────────────────────────────────────────── */

test("normalizePermissions pulls in the view dependency", () => {
  assert.deepEqual(normalizePermissions(["products.edit"]).sort(), [
    "products.edit",
    "products.view",
  ]);
});

test("ordinary roles use (role ∪ grants) − denials", () => {
  const effective = computeEffectivePermissions({
    rolePermissions: ["products.view", "products.edit"],
    grants: ["orders.view"],
    denials: ["products.edit"],
  });
  assert.deepEqual(effective.sort(), ["orders.view", "products.view"]);
});

test("denials win over grants and cascade to dependants (fail closed)", () => {
  const effective = computeEffectivePermissions({
    rolePermissions: ["products.view", "products.edit", "products.delete"],
    grants: ["products.create"],
    denials: ["products.view"],
  });
  assert.deepEqual(effective, [], "حذف پیش‌نیاز باید همه‌ی اکشن‌های وابسته را ببرد");
});

test("protected full-access role is NOT customizable by grants or denials", () => {
  const all = getAllPermissionKeys().sort();
  const effective = computeEffectivePermissions({
    rolePermissions: [],
    grants: ["products.view"],
    denials: ["products.view", "orders.view", "admins.view"],
    fullAccess: true,
  });
  assert.deepEqual(effective.sort(), all, "grants/denials باید نادیده گرفته شوند");
});

test("full-access covers future keys because it is computed from the registry", () => {
  const effective = computeEffectivePermissions({ fullAccess: true });
  for (const key of getAllPermissionKeys()) {
    assert.ok(effective.includes(key), `${key} پوشش داده نشد`);
  }
});

test("no membership means no permissions", () => {
  assert.deepEqual(computeEffectivePermissions(), []);
  assert.deepEqual(computeEffectivePermissions({}), []);
});

test("hasPermission supports all/any modes", () => {
  const effective = ["orders.view", "orders.changeStatus"];
  assert.equal(hasPermission(effective, "orders.view"), true);
  assert.equal(hasPermission(effective, ["orders.view", "products.view"]), false);
  assert.equal(
    hasPermission(effective, ["orders.view", "products.view"], { mode: "any" }),
    true
  );
  assert.equal(hasPermission(effective, []), true);
});

test("navigation metadata only exposes sections the admin can reach", () => {
  const sections = getVisibleSections(["orders.view", "orderTracking.view"]);
  assert.deepEqual(sections.map((s) => s.key), ["orders"]);
  assert.deepEqual(
    sections[0].modules.map((m) => m.key),
    ["orders", "orderTracking"]
  );
});

/* ── مرز اعتبارسنجی سخت (۴۲۲ به‌جای حذف خاموش) ────────────────────────── */

test("validatePermissionKeys rejects instead of silently dropping", () => {
  const ok = validatePermissionKeys(["products.view", "products.view"]);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.permissions, ["products.view"]);

  const bad = validatePermissionKeys([
    "products.view",
    "inventory.view",
    "events.edit",
    "nope.nope",
  ]);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.permissions, []);
  assert.deepEqual(bad.invalid.retired.map((r) => r.key), ["inventory.view"]);
  assert.deepEqual(bad.invalid.ambiguous.map((r) => r.key), ["events.edit"]);
  assert.deepEqual(bad.invalid.unknown, ["nope.nope"]);
  assert.ok(bad.message.length > 0);

  assert.equal(validatePermissionKeys(undefined).ok, true);
  assert.equal(validatePermissionKeys("products.view").ok, false);
});

test("sanitizePermissions stays as the legacy silent filter", () => {
  assert.deepEqual(sanitizePermissions(null), []);
  assert.deepEqual(
    sanitizePermissions(["products.view", "products.view", "inventory.view"]),
    ["products.view"]
  );
});

test("classifyPermissionKeys separates valid, retired, ambiguous and unknown", () => {
  const report = classifyPermissionKeys([
    "products.view",
    "inventory.view",
    "events.edit",
    "nope.nope",
  ]);
  assert.deepEqual(report.valid, ["products.view"]);
  assert.deepEqual(report.retired.map((r) => r.key), ["inventory.view"]);
  assert.deepEqual(report.ambiguous.map((r) => r.key), ["events.edit"]);
  assert.deepEqual(report.unknown, ["nope.nope"]);
});

/* ── نقشِ محافظت‌شده ──────────────────────────────────────────────────── */

test("protected role fields can never arrive from the API", () => {
  const { payload, rejected } = stripProtectedRoleFields({
    name: "x",
    permissions: [],
    isSystem: true,
    isFullAccess: true,
    systemKey: SUPER_ADMIN_SYSTEM_KEY,
  });
  assert.deepEqual(Object.keys(payload).sort(), ["name", "permissions"]);
  assert.deepEqual(rejected.sort(), [...PROTECTED_ROLE_FIELDS].sort());
});

test("role protection is by flags/systemKey, never by display name", () => {
  assert.equal(isProtectedRole({ systemKey: SUPER_ADMIN_SYSTEM_KEY }), true);
  assert.equal(isProtectedRole({ isFullAccess: true }), true);
  assert.equal(isProtectedRole({ isSystem: true }), true);
  assert.equal(isProtectedRole({ name: SUPER_ADMIN_ROLE_NAME }), false);
  assert.equal(canModifyRole({ name: SUPER_ADMIN_ROLE_NAME }).ok, true);
  assert.equal(canModifyRole({ isFullAccess: true }).reason, "protected-role");
});

test("resolveSuperRole never adopts a look-alike role by name", () => {
  const impostor = { _id: "r1", name: SUPER_ADMIN_ROLE_NAME };
  const result = resolveSuperRole([impostor]);
  assert.equal(result.role, null);
  assert.equal(result.action, "create");
  assert.ok(result.blockers.length > 0, "هم‌نامی باید مسدودکننده باشد");
});

test("resolveSuperRole adopts by systemKey and blocks multiple candidates", () => {
  const marked = {
    _id: "r1",
    name: "هرچیزی",
    systemKey: SUPER_ADMIN_SYSTEM_KEY,
    isSystem: true,
    isFullAccess: true,
  };
  assert.equal(resolveSuperRole([marked]).action, "noop");

  const partial = { _id: "r2", systemKey: SUPER_ADMIN_SYSTEM_KEY };
  assert.equal(resolveSuperRole([partial]).action, "adopt");

  // دو کاندیدِ *واقعی* (systemKey + ترکیب صریح پرچم‌ها) → ابهام
  const two = resolveSuperRole([
    marked,
    { _id: "r3", name: "دیگری", isSystem: true, isFullAccess: true },
  ]);
  assert.ok(two.blockers.some((b) => b.includes("کاندید")));

  // نقشِ صرفاً isFullAccess کاندید نیست، ولی ناهنجاری است و مسدود می‌کند
  const loose = resolveSuperRole([marked, { _id: "r4", name: "شل", isFullAccess: true }]);
  assert.ok(!loose.blockers.some((b) => b.includes("کاندید")));
  assert.ok(loose.blockers.some((b) => b.includes("isFullAccess")));
});

/* ── تصمیم دسترسی (منطق adminContext) ─────────────────────────────────── */

test("active membership grants access from the membership source", () => {
  const decision = decideMembershipAccess({
    memberships: [{ _id: "a1", isActive: true }],
    hasLegacyAdminRole: false,
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.source, "membership");
});

test("revoked membership denies and never falls back to User.role=admin", () => {
  const decision = decideMembershipAccess({
    memberships: [{ _id: "a1", isActive: false, revokedAt: new Date() }],
    hasLegacyAdminRole: true,
  });
  assert.equal(decision.allowed, false, "این دقیقاً حالت fail-open قبلی بود");
  assert.equal(decision.source, "none");
  assert.equal(decision.reason, "membership-revoked");
});

test("inactive-but-never-revoked membership also denies", () => {
  const decision = decideMembershipAccess({
    memberships: [{ _id: "a1", isActive: false }],
    hasLegacyAdminRole: true,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "membership-inactive");
});

test("the legacy User.role=admin fallback is gone (phase 7 cutover)", () => {
  // پیش از کات‌اوور، این حالت allowed=true با source="legacy-user-role"
  // برمی‌گرداند و همه‌ی کلیدها را می‌داد. حالا نقشِ کاربری هیچ اثری ندارد.
  const legacy = decideMembershipAccess({
    memberships: [],
    hasLegacyAdminRole: true,
  });
  assert.equal(legacy.allowed, false);
  assert.equal(legacy.source, "none");
  assert.equal(legacy.reason, "no-membership");

  const none = decideMembershipAccess({
    memberships: [],
    hasLegacyAdminRole: false,
  });
  assert.deepEqual(none, legacy, "نقشِ legacy نباید هیچ تفاوتی بسازد");
});

test("nothing in the codebase still grants access from User.role", () => {
  // گیتِ legacy کاملاً حذف شد؛ باقی‌ماندنِ فایل یعنی مسیرِ دومِ مجوز.
  assert.equal(
    fs.existsSync(path.join(process.cwd(), "src/lib/requireAdmin.js")),
    false,
    "src/lib/requireAdmin.js هنوز وجود دارد"
  );

  const context = readNormalized("src/lib/adminContext.js").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    ""
  );
  // دسترسی فقط از شاخه‌ی membership می‌آید؛ هر چیز دیگری آرایه‌ی خالی است.
  assert.match(context, /decision\.allowed && decision\.source === "membership"/);
  assert.doesNotMatch(context, /getAllPermissionKeys/);

  const guards = readNormalized("src/lib/adminGuards.js").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    ""
  );
  assert.doesNotMatch(guards, /legacy-user-role/);
});

test("duplicate memberships fail closed instead of picking a row", () => {
  const decision = decideMembershipAccess({
    memberships: [
      { _id: "a1", isActive: true },
      { _id: "a2", isActive: true },
    ],
    hasLegacyAdminRole: true,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "duplicate-membership");
  assert.equal(decision.membership, null);
});

/* ── resolverهای شاخه‌ای (fail-closed) ────────────────────────────────── */

test("site-setting resolver covers every known key and fails closed otherwise", () => {
  const all = new Set(getAllPermissionKeys());

  for (const key of Object.keys(SITE_SETTING_OWNERS)) {
    for (const action of ["view", "edit"]) {
      const out = resolveSiteSettingPermission(key, action);
      assert.equal(out.allowed, true, `${key}/${action} باید حل شود`);
      assert.equal(out.reason, "ok");
      assert.equal(out.permissions.length, 1);
      assert.ok(all.has(out.permissions[0]), `${out.permissions[0]} در رجیستری نیست`);
    }
    // مالکِ view و edit نباید یکی باشند
    assert.notEqual(
      resolveSiteSettingPermission(key, "view").permissions[0],
      resolveSiteSettingPermission(key, "edit").permissions[0]
    );
  }

  // defaultِ نامعتبر → هیچ کلیدی، یعنی رد
  for (const bad of [
    ["totally_unknown_key", "view"],
    ["bank_account_details", "delete"],
    ["", "view"],
    [null, "view"],
    [42, "edit"],
  ]) {
    const out = resolveSiteSettingPermission(bad[0], bad[1]);
    assert.equal(out.allowed, false, `${JSON.stringify(bad)} باید رد شود`);
    assert.deepEqual(out.permissions, []);
    assert.notEqual(out.reason, "ok");
  }
});

test("user PATCH resolver maps each field family and fails closed", () => {
  const all = new Set(getAllPermissionKeys());

  assert.deepEqual(resolveUserPatchPermissions({ name: "x" }).permissions, [
    "users.edit",
  ]);
  assert.deepEqual(resolveUserPatchPermissions({ isBanned: true }).permissions, [
    "users.ban",
  ]);
  assert.deepEqual(resolveUserPatchPermissions({ role: "coach" }).permissions, [
    "users.changeRole",
  ]);

  // چند خانواده با هم → همه‌ی کلیدها لازم است
  const combined = resolveUserPatchPermissions({
    name: "x",
    isBanned: true,
    role: "seller",
  });
  assert.deepEqual(combined.permissions.sort(), [
    "users.ban",
    "users.changeRole",
    "users.edit",
  ]);
  assert.equal(combined.mode, "all");

  for (const key of combined.permissions) {
    assert.ok(all.has(key), `${key} در رجیستری نیست`);
  }

  // ⚠️ ادمین‌کردن از این مسیر با هیچ کلیدی مجاز نیست
  const escalation = resolveUserPatchPermissions({ role: "admin" });
  assert.equal(escalation.allowed, false);
  assert.deepEqual(escalation.permissions, []);
  assert.equal(escalation.reason, "admin-role-not-assignable-here");
  // حتی همراه فیلدهای بی‌خطر
  assert.equal(
    resolveUserPatchPermissions({ name: "x", role: "admin" }).allowed,
    false
  );

  // defaultِ نامعتبر → رد
  for (const bad of [{}, null, undefined, [], "x", { password: "p" }, { level: 1, nope: 2 }]) {
    const out = resolveUserPatchPermissions(bad);
    assert.equal(out.allowed, false, `${JSON.stringify(bad)} باید رد شود`);
    assert.deepEqual(out.permissions, []);
    assert.notEqual(out.reason, "ok");
  }
});

test("a resolver DENY is a real deny end-to-end, never an accidental allow", () => {
  // این تستِ ضدرگرسیونِ اصلیِ این باگ است: آرایه‌ی خالی در JS truthy است و
  // hasPermission(x, [], {mode:"all"}) هم true می‌دهد؛ بدون قرارداد `allowed`
  // و بدون گاردِ empty-requirement، هر DENY تبدیل به ALLOW می‌شد.
  const superAdmin = {
    isAdmin: true,
    permissions: getAllPermissionKeys(),
    userId: "u1",
  };

  const denials = [
    resolveUserPatchPermissions({ role: "admin" }),
    resolveUserPatchPermissions({}),
    resolveUserPatchPermissions({ password: "x" }),
    resolveSiteSettingPermission("unknown_key", "edit"),
    resolveSiteSettingPermission("bank_account_details", "nope"),
  ];

  for (const resolved of denials) {
    assert.equal(resolved.allowed, false);

    // مسیر درست: هندلر قبل از گیت رد می‌کند
    assert.ok(!resolved.allowed, "هندلر باید همین‌جا ۴۰۳ بدهد");

    // و حتی اگر کسی این گارد را فراموش کند، خودِ گیت هم باید رد کند
    const decision = decideGateOutcome({
      ctx: superAdmin,
      required: resolved.permissions,
      mode: resolved.mode,
    });
    assert.equal(decision.status, 403, "گیت هم باید آرایه‌ی خالی را رد کند");
    assert.equal(decision.outcome, "empty-requirement");
  }

  // و برعکس: null یعنی «هر ادمین معتبر» و باید مجاز بماند
  assert.equal(decideGateOutcome({ ctx: superAdmin, required: null }).status, 200);
});

test("every manifest key — including branch resolvers — exists in the registry", () => {
  const all = new Set(getAllPermissionKeys());
  const collect = (table) => {
    for (const [route, methods] of Object.entries(table)) {
      for (const [method, value] of Object.entries(methods)) {
        if (value === null || isBranch(value)) continue;
        const keys = Array.isArray(value)
          ? value
          : Array.isArray(value?.any)
            ? value.any
            : [value];
        for (const key of keys) {
          assert.ok(all.has(key), `${method} ${route} → «${key}» در رجیستری نیست`);
        }
      }
    }
  };
  collect(ADMIN_API_PERMISSIONS);
  collect(PUBLIC_ADMIN_API_PERMISSIONS);
});

/* ── PUT /admin/admins/[id] — تفکیک عملیات ─────────────────────────────── */

test("admin PATCH resolver separates edit / activate / revoke / permissions", () => {
  const all = new Set(getAllPermissionKeys());

  // `title` تنها فیلدِ «ویرایشِ ساده» است (فاز ۳: هویت دیگر دستی نیست).
  assert.deepEqual(resolveAdminPatchPermissions({ title: "x" }).permissions, [
    "admins.edit",
  ]);
  assert.deepEqual(resolveAdminPatchPermissions({ isActive: true }).permissions, [
    "admins.activate",
  ]);
  assert.deepEqual(resolveAdminPatchPermissions({ isActive: false }).permissions, [
    "admins.revoke",
  ]);
  for (const field of ["permissions", "permissionGrants", "permissionDenials"]) {
    assert.deepEqual(
      resolveAdminPatchPermissions({ [field]: [] }).permissions,
      ["admins.managePermissions"],
      field
    );
  }

  // ترکیبی → همه‌ی کلیدها
  const combined = resolveAdminPatchPermissions({
    title: "x",
    isActive: false,
    permissionGrants: [],
  });
  assert.deepEqual(combined.permissions.sort(), [
    "admins.edit",
    "admins.managePermissions",
    "admins.revoke",
  ]);
  assert.equal(combined.mode, "all");
  for (const key of combined.permissions) assert.ok(all.has(key));

  // رگرسیون: admins.edit به‌تنهایی دیگر اجازه‌ی تغییر دسترسی/وضعیت نمی‌دهد
  assert.ok(
    !resolveAdminPatchPermissions({ permissions: [] }).permissions.includes(
      "admins.edit"
    )
  );

  // fail-closed
  for (const bad of [
    {},
    null,
    [],
    "x",
    { isActive: "false" },
    { isActive: 1 },
    { nope: 1 },
    { revokeReason: "x" },
    { revokeReason: "x", isActive: true },
  ]) {
    const out = resolveAdminPatchPermissions(bad);
    assert.equal(out.allowed, false, JSON.stringify(bad));
    assert.deepEqual(out.permissions, []);
  }

  // revokeReason همراهِ لغو مجاز است
  assert.equal(
    resolveAdminPatchPermissions({ isActive: false, revokeReason: "x" }).allowed,
    true
  );
});

/* ── ارتقای دسترسی در نوشتنِ ادمین/نقش ─────────────────────────────────── */

test("a non-full-access actor cannot hand out a full-access role", () => {
  const fullRole = { permissions: [], isFullAccess: true };

  const weak = assertRoleAssignable({
    actorPermissions: ["admins.create"],
    actorIsFullAccess: false,
    role: fullRole,
  });
  assert.equal(weak.ok, false);
  assert.equal(weak.reason, "cannot-grant-full-access");

  const superActor = assertRoleAssignable({
    actorPermissions: [],
    actorIsFullAccess: true,
    role: fullRole,
  });
  assert.equal(superActor.ok, true);
});

test("a role may not be assigned if it exceeds the actor's own permissions", () => {
  const strong = { permissions: ["orders.view", "admins.managePermissions"] };

  const denied = assertRoleAssignable({
    actorPermissions: ["orders.view"],
    actorIsFullAccess: false,
    role: strong,
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "role-exceeds-actor");
  assert.deepEqual(denied.escalated, ["admins.managePermissions"]);

  assert.equal(
    assertRoleAssignable({
      actorPermissions: ["orders.view", "admins.managePermissions"],
      role: strong,
    }).ok,
    true
  );
});

test("a weaker actor cannot edit or weaken a stronger role", () => {
  const strong = { permissions: ["orders.view", "users.ban"] };

  const denied = assertRoleModifiable({
    actorPermissions: ["orders.view"],
    actorIsFullAccess: false,
    role: strong,
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "role-stronger-than-actor");
  assert.deepEqual(denied.escalated, ["users.ban"]);

  // نقشِ محافظت‌شده حتی برای full-access هم از مسیر API قفل است
  assert.equal(
    assertRoleModifiable({
      actorIsFullAccess: true,
      role: { isFullAccess: true, permissions: [] },
    }).reason,
    "protected-role"
  );

  // هم‌سطح یا ضعیف‌تر → مجاز
  assert.equal(
    assertRoleModifiable({
      actorPermissions: ["orders.view", "users.ban"],
      role: strong,
    }).ok,
    true
  );
});

/* ── ناوردای آخرین سوپرادمین ───────────────────────────────────────────── */

test("usable super admins are counted with role, activity and ban all required", () => {
  const roleId = "role-super";
  const u1 = "u1";
  const u2 = "u2";

  const base = [
    { user: u1, role: roleId, isActive: true },
    { user: u2, role: roleId, isActive: true },
  ];
  assert.equal(countUsableSuperAdmins(base, new Set([u1, u2]), roleId), 2);

  // کاربر مسدود شمرده نمی‌شود
  assert.equal(countUsableSuperAdmins(base, new Set([u1]), roleId), 1);
  // عضویت غیرفعال شمرده نمی‌شود
  assert.equal(
    countUsableSuperAdmins(
      [{ user: u1, role: roleId, isActive: false }],
      new Set([u1]),
      roleId
    ),
    0
  );
  // نقشِ دیگر شمرده نمی‌شود
  assert.equal(
    countUsableSuperAdmins(
      [{ user: u1, role: "other", isActive: true }],
      new Set([u1]),
      roleId
    ),
    0
  );
  // بدون نقشِ سوپر، هیچ
  assert.equal(countUsableSuperAdmins(base, new Set([u1, u2]), null), 0);
});

/* ── کمترین امتیاز در اعلان‌ها ─────────────────────────────────────────── */

test("the notification bell only exposes modules the admin can reach", () => {
  const sectionByType = {
    new_order: "orders",
    new_payment: "orders",
    coach_student_order: "coachCredits",
    coach_application: "coachApplications",
    new_ticket: "support",
  };
  const payload = {
    items: [
      { type: "new_order", message: "سفارش" },
      { type: "new_ticket", message: "تیکت" },
      { type: "coach_application", message: "مربی" },
    ],
    counts: {
      total: 12,
      byType: {
        new_order: 5,
        new_payment: 2,
        coach_student_order: 1,
        coach_application: 1,
        new_ticket: 3,
      },
      sections: { orders: 7, coachCredits: 1, coachApplications: 1, support: 3 },
    },
    contactNew: 4,
  };

  // ادمینی که فقط تیکت دارد
  const t = filterNotificationPayload(payload, ["tickets.view"], sectionByType);
  assert.deepEqual(t.items.map((i) => i.type), ["new_ticket"]);
  assert.equal(t.counts.byType.new_order, 0);
  assert.equal(t.counts.byType.new_ticket, 3);
  assert.equal(t.counts.sections.orders, 0);
  assert.equal(t.counts.sections.support, 3);
  assert.equal(t.counts.total, 3, "total باید از byTypeِ فیلترشده بازمحاسبه شود");
  assert.equal(t.contactNew, 0, "بدون contactMessages.view نباید شمارنده بدهد");

  // ادمینِ بدون هیچ دسترسیِ اعلانی
  const none = filterNotificationPayload(payload, ["articles.view"], sectionByType);
  assert.deepEqual(none.items, []);
  assert.equal(none.counts.total, 0);
  assert.deepEqual(Object.values(none.counts.sections), [0, 0, 0, 0]);

  // با contactMessages.view شمارنده برمی‌گردد
  assert.equal(
    filterNotificationPayload(payload, ["contactMessages.view"], sectionByType)
      .contactNew,
    4
  );
});

test("marking notifications read cannot touch a module the admin lacks", () => {
  const perms = ["tickets.view"];

  // درخواستِ نوعِ غیرمجاز → حذف می‌شود
  assert.deepEqual(
    constrainReadFilterToPermissions({ type: "new_order" }, perms).type,
    []
  );
  // ترکیبی → فقط مجازها
  assert.deepEqual(
    constrainReadFilterToPermissions(
      { type: ["new_order", "new_ticket"] },
      perms
    ).type,
    ["new_ticket"]
  );
  // بدون type → فقط انواعِ مجاز
  assert.deepEqual(constrainReadFilterToPermissions({}, perms).type, ["new_ticket"]);
  // ⚠️ ids و all هم نمی‌توانند دور بزنند، چون type همیشه تحمیل می‌شود
  const id1 = "507f1f77bcf86cd799439011";
  const id2 = "507f1f77bcf86cd799439012";
  const byIds = constrainReadFilterToPermissions(
    { ids: [id1, id2], all: true },
    perms
  );
  assert.deepEqual(byIds.type, ["new_ticket"]);
  assert.deepEqual(byIds.ids, [id1, id2]);
  // ادمینِ بی‌دسترسی → هیچ نوعی
  assert.deepEqual(constrainReadFilterToPermissions({ all: true }, []).type, []);
});

test("a malformed id narrows the read filter to nothing, never widens it", () => {
  const perms = ["tickets.view", "orders.view"];
  const good = "507f1f77bcf86cd799439011";

  // شناسه‌ی بدشکل نباید فقط «حذف» شود: آن‌وقت «این دو اعلان» به «همه‌ی
  // اعلان‌های مجاز» گشاد می‌شد و کاربر بی‌خبر همه را خوانده‌شده می‌کرد.
  assert.deepEqual(constrainReadFilterToPermissions({ ids: ["a"] }, perms), {
    type: [],
  });
  assert.deepEqual(constrainReadFilterToPermissions({ ids: [] }, perms), {
    type: [],
  });
  assert.deepEqual(
    constrainReadFilterToPermissions({ ids: "not-an-array" }, perms),
    { type: [] }
  );
  // آبجکتِ عملگرِ Mongo هم شناسه نیست
  assert.deepEqual(
    constrainReadFilterToPermissions({ order: { $ne: null } }, perms),
    { type: [] }
  );
  for (const ref of ["order", "coach", "ticket"]) {
    assert.deepEqual(
      constrainReadFilterToPermissions({ [ref]: "nope" }, perms),
      { type: [] },
      `${ref} بدشکل باید فیلتر را به هیچ تبدیل کند`
    );
    assert.equal(
      constrainReadFilterToPermissions({ [ref]: good }, perms)[ref],
      good
    );
  }

  // "true"/"false" رشته‌ای هرگز «همه» نیست
  assert.equal(
    constrainReadFilterToPermissions({ all: "false" }, perms).all,
    undefined
  );
  assert.equal(constrainReadFilterToPermissions({ all: true }, perms).all, true);
});

/* ── قرارداد ۴۰۱/۴۰۳ گیت ──────────────────────────────────────────────── */

test("401 is ONLY for a missing identity", () => {
  // resolveAdminContext فقط در این سه حالت null می‌دهد: توکن نیست، توکن
  // نامعتبر است، یا کاربرِ توکن در دیتابیس نیست.
  assert.deepEqual(decideGateOutcome({ ctx: null }), {
    status: 401,
    outcome: "no-identity",
  });
  assert.equal(decideGateOutcome({ ctx: null, required: "orders.view" }).status, 401);
  assert.equal(decideGateOutcome().status, 401);
});

test("an authenticated but unauthorized identity gets 403, never 401", () => {
  // رگرسیون: این حالت‌ها قبلاً ۴۰۱ می‌گرفتند و کلاینت آن را «نشست منقضی شده»
  // تفسیر می‌کرد، در حالی که کاربر کاملاً لاگین است.
  const cases = [
    ["no-membership", "کاربر عادی بدون عضویت و بدون نقش legacy"],
    ["membership-revoked", "عضویت لغو شده"],
    ["membership-inactive", "عضویت غیرفعال"],
    ["duplicate-membership", "عضویت تکراری"],
    ["user-banned", "کاربر مسدود"],
  ];

  for (const [denyReason, label] of cases) {
    const decision = decideGateOutcome({
      ctx: { isAdmin: false, denyReason, permissions: [], userId: "u1" },
      required: "orders.view",
    });
    assert.equal(decision.status, 403, `${label} باید ۴۰۳ بگیرد`);
    assert.equal(decision.outcome, denyReason);
  }

  // حتی بدون کلیدِ لازم هم ۴۰۳ است، نه ۴۰۱
  assert.equal(
    decideGateOutcome({ ctx: { isAdmin: false, permissions: [] } }).status,
    403
  );
});

test("an authorized admin missing the specific key gets 403", () => {
  const ctx = { isAdmin: true, permissions: ["orders.view"], userId: "u1" };

  assert.equal(decideGateOutcome({ ctx, required: "orders.view" }).status, 200);
  assert.equal(decideGateOutcome({ ctx, required: null }).status, 200);
  assert.equal(decideGateOutcome({ ctx }).status, 200);

  const denied = decideGateOutcome({ ctx, required: "orders.changeStatus" });
  assert.equal(denied.status, 403);
  assert.equal(denied.outcome, "missing-permission");

  // حالت any
  assert.equal(
    decideGateOutcome({
      ctx,
      required: ["orders.view", "products.view"],
      mode: "any",
    }).status,
    200
  );
  assert.equal(
    decideGateOutcome({ ctx, required: ["orders.view", "products.view"] }).status,
    403,
    "حالت all باید هر دو را بخواهد"
  );
});

test("the 403 body never leaks authorization internals", async () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src", "lib", "requireAdminPermission.js"),
    "utf8"
  );
  const forbiddenFn = source.slice(
    source.indexOf("export function forbidden("),
    source.indexOf("export default")
  );
  assert.ok(
    !/requiredPermissions|outcome|denyReason|permissions\b/.test(forbiddenFn),
    "پاسخ ۴۰۳ نباید کلید لازم یا دلیل رد را برگرداند"
  );
  assert.match(forbiddenFn, /status:\s*403/);
});

/* ── گاردهای فاز ۲ (هنوز به روتی وصل نیستند) ──────────────────────────── */

test("nobody can grant a permission they do not hold", () => {
  const escalation = assertNoPrivilegeEscalation({
    actorPermissions: ["products.view"],
    requestedPermissions: ["products.view", "admins.managePermissions"],
  });
  assert.equal(escalation.ok, false);
  assert.deepEqual(escalation.escalated, ["admins.managePermissions"]);

  const superAdmin = assertNoPrivilegeEscalation({
    actorPermissions: [],
    actorIsFullAccess: true,
    requestedPermissions: ["admins.managePermissions"],
  });
  assert.equal(superAdmin.ok, true);
});

test("admins cannot manage themselves or a stronger admin", () => {
  assert.equal(
    canManageAdmin({ actorUserId: "u1", target: { user: "u1" } }).reason,
    "self-management"
  );
  assert.equal(
    canManageAdmin({
      actorUserId: "u1",
      target: { user: "u2" },
      targetRoleIsFullAccess: true,
    }).reason,
    "target-is-super-admin"
  );
  assert.equal(
    canManageAdmin({ actorUserId: "u1", target: { user: "u2" } }).ok,
    true
  );
});

/* ── هلپرهای خالصِ مهاجرت ─────────────────────────────────────────────── */

// شناسه‌های غیرکاربری (مثل _id سند و نقش) به‌صورت رشته کافی‌اند
const oid = (n) => `0000000000000000000000${String(n).padStart(2, "0")}`;

// فیلد `user` باید ObjectIdِ *واقعی* باشد — دقیقاً همان چیزی که partial index
// می‌بیند. قطعی و پایدار در طول یک اجرا.
const userIdCache = new Map();
const uid = (n) => {
  if (!userIdCache.has(n)) userIdCache.set(n, new mongoose.Types.ObjectId());
  return userIdCache.get(n);
};
const uhex = (n) => uid(n).toHexString();

test("admin records split into linked, unlinked, orphan and ambiguous", () => {
  const existing1 = objectId();
  const existing2 = objectId();
  const gone = objectId();

  const out = classifyAdminRecords(
    [
      { _id: "a1", user: existing1 },
      { _id: "a2", user: null },
      { _id: "a3", user: gone },
      { _id: "a4", user: existing2 },
      { _id: "a5", user: existing2 },
    ],
    new Set([existing1.toHexString(), existing2.toHexString()])
  );

  assert.deepEqual(out.linked.map((a) => a._id), ["a1"]);
  assert.deepEqual(out.unlinked.map((a) => a._id), ["a2"]);
  assert.deepEqual(out.orphan.map((a) => a._id), ["a3"]);
  assert.deepEqual(out.ambiguous.map((a) => a.userId), [existing2.toHexString()]);
  assert.deepEqual(out.malformed, []);
});

test("duplicate ORPHAN memberships are ambiguous too — the unique index does not care whether the User exists", () => {
  const gone = objectId();

  const out = classifyAdminRecords(
    [
      { _id: "a1", user: gone },
      { _id: "a2", user: gone },
    ],
    new Set() // هیچ کاربری وجود ندارد
  );

  // رگرسیون: قبلاً هر دو orphan می‌شدند و ambiguous خالی بود، پس مهاجرت
  // canApply=true می‌گرفت و بعداً ساخت ایندکس یکتا شکست می‌خورد.
  assert.deepEqual(out.orphan, []);
  assert.equal(out.ambiguous.length, 1);
  assert.equal(out.ambiguous[0].userId, gone.toHexString());
  assert.equal(out.ambiguous[0].userExists, false);
  assert.deepEqual(out.ambiguous[0].admins.map((a) => a._id), ["a1", "a2"]);
});

test("duplicate orphan memberships block the apply", () => {
  const gone = objectId();
  const plan = planMigration({
    adminUsers: [{ _id: objectId(), name: "سالم" }],
    admins: [
      { _id: objectId(), user: gone, username: "d1", isActive: true },
      { _id: objectId(), user: gone, username: "d2", isActive: true },
    ],
    roles: [],
    existingUserIds: new Set(),
  });

  assert.equal(plan.canApply, false);
  assert.ok(plan.blockers.some((b) => b.includes(gone.toHexString())));
  assert.ok(plan.blockers.some((b) => b.includes("کاربرش وجود ندارد")));
});

test("duplicates on a referenced, existing user id also block", () => {
  const live = objectId();
  const plan = planMigration({
    adminUsers: [{ _id: live, name: "علی" }],
    admins: [
      { _id: objectId(), user: live, username: "d1", isActive: true },
      { _id: objectId(), user: live, username: "d2", isActive: true },
    ],
    roles: [],
    existingUserIds: new Set([live.toHexString()]),
  });

  assert.equal(plan.canApply, false);
  assert.equal(plan.createMemberships.length, 0);
  assert.ok(plan.blockers.some((b) => b.includes(live.toHexString())));
});

test("the user ref shape mirrors the partial index exactly", () => {
  const real = objectId();
  assert.deepEqual(describeUserRef(real), {
    kind: "objectId",
    key: real.toHexString(),
  });

  for (const empty of [null, undefined, ""]) {
    assert.equal(describeUserRef(empty).kind, "missing");
  }

  // ⚠️ رشته‌ی ۲۴ حرفی ObjectId نیست: partial index با $type:"objectId" آن را
  // ایندکس نمی‌کند و کوئریِ ObjectId هم پیدایش نمی‌کند.
  assert.equal(describeUserRef(real.toHexString()).kind, "malformed");
  assert.equal(describeUserRef(42).kind, "malformed");
  assert.equal(describeUserRef({}).kind, "malformed");
});

test("a non-ObjectId user field is blocked, never silently indexed or linked", () => {
  const live = objectId();
  const plan = planMigration({
    adminUsers: [{ _id: live, name: "علی" }],
    admins: [
      {
        _id: objectId(),
        user: live.toHexString(), // رشته، نه ObjectId
        username: "broken",
        isActive: true,
      },
    ],
    roles: [],
    existingUserIds: new Set([live.toHexString()]),
  });

  assert.equal(plan.classified.malformed.length, 1);
  assert.deepEqual(plan.classified.linked, []);
  assert.equal(plan.canApply, false);
  assert.ok(plan.blockers.some((b) => b.includes("ObjectId نیست")));
});

test("derived usernames are deterministic and never collide", () => {
  const taken = new Set();
  const user = { _id: oid(1) };
  const first = deriveUsername(user, taken);
  assert.equal(deriveUsername(user, taken), first, "بدون تصادم باید قطعی باشد");
  taken.add(first);
  assert.equal(deriveUsername(user, taken), `${first}-2`);
});

test("plan creates one membership per unlinked admin user and is idempotent", () => {
  const adminUsers = [
    { _id: uid(1), name: "علی", lastName: "رضایی" },
    { _id: uid(2), phone: "09120000000" },
  ];

  const first = planMigration({
    adminUsers,
    admins: [],
    roles: [],
    existingUserIds: new Set([uhex(1), uhex(2)]),
  });
  assert.equal(first.roleAction, "create");
  assert.equal(first.createMemberships.length, 2);
  assert.equal(first.canApply, true);

  const superRole = {
    _id: oid(50),
    name: SUPER_ADMIN_ROLE_NAME,
    systemKey: SUPER_ADMIN_SYSTEM_KEY,
    isSystem: true,
    isFullAccess: true,
  };
  const applied = first.createMemberships.map((m, i) => ({
    _id: oid(60 + i),
    user: m.user,
    username: m.username,
    role: superRole._id,
    isActive: true,
    permissions: [],
    permissionGrants: [],
  }));

  const second = planMigration({
    adminUsers,
    admins: applied,
    roles: [superRole],
    existingUserIds: new Set([uhex(1), uhex(2)]),
  });
  assert.equal(second.roleAction, "noop");
  assert.equal(second.createMemberships.length, 0);
  assert.equal(second.grantBackfills.length, 0);
  assert.equal(second.roleKeyMigrations.length, 0);
  assert.equal(second.projectedSuperAdmins, 2);
  assert.equal(second.canApply, true);
});

test("duplicate memberships BLOCK the whole apply, not just a warning", () => {
  const plan = planMigration({
    adminUsers: [{ _id: uid(1), name: "علی" }],
    admins: [
      { _id: oid(60), user: uid(1), isActive: true },
      { _id: oid(61), user: uid(1), isActive: true },
    ],
    roles: [],
    existingUserIds: new Set([uhex(1)]),
  });
  assert.equal(plan.canApply, false, "باید قبل از هر نوشتنی متوقف شود");
  assert.equal(plan.createMemberships.length, 0);
  assert.ok(plan.blockers.some((b) => b.includes(uhex(1))));
});

test("a name-only super role collision blocks apply", () => {
  const plan = planMigration({
    adminUsers: [{ _id: uid(1), name: "علی" }],
    admins: [],
    roles: [{ _id: oid(50), name: SUPER_ADMIN_ROLE_NAME }],
    existingUserIds: new Set([uhex(1)]),
  });
  assert.equal(plan.canApply, false);
  assert.ok(plan.blockers.some((b) => b.includes("هم‌نام")));
});

test("plan refuses when it would leave zero usable super admins", () => {
  const plan = planMigration({
    adminUsers: [],
    admins: [{ _id: oid(60), user: uid(1), role: null, isActive: true }],
    roles: [],
    existingUserIds: new Set([uhex(1)]),
  });
  assert.equal(plan.projectedSuperAdmins, 0);
  assert.equal(plan.canApply, false);
});

test("a banned user never counts as the last usable super admin", () => {
  assert.equal(isUsableAdminUser({ isBanned: true }), false);

  const plan = planMigration({
    adminUsers: [{ _id: uid(1), name: "مسدود", isBanned: true }],
    admins: [],
    roles: [],
    existingUserIds: new Set([uhex(1)]),
  });
  assert.equal(plan.projectedSuperAdmins, 0);
  assert.equal(plan.canApply, false, "کاربر مسدود نباید تنها سوپرادمین شمرده شود");

  // ولی عضویتش staged (غیرفعال) برنامه‌ریزی می‌شود تا سابقه بماند
  assert.equal(plan.createMemberships.length, 1);
  assert.equal(plan.createMemberships[0].isActive, false);
  assert.equal(plan.createMemberships[0].staged, true);
});

test("banned admin is staged inactive alongside a usable super admin", () => {
  const plan = planMigration({
    adminUsers: [
      { _id: uid(1), name: "سالم" },
      { _id: uid(2), name: "مسدود", isBanned: true },
    ],
    admins: [],
    roles: [],
    existingUserIds: new Set([uhex(1), uhex(2)]),
  });
  assert.equal(plan.canApply, true);
  assert.equal(plan.projectedSuperAdmins, 1, "فقط کاربر قابل‌استفاده شمرده شود");
  assert.deepEqual(
    plan.createMemberships.map((m) => m.isActive),
    [true, false]
  );
});

test("legacy snapshot backfill rewrites, drops and preserves deterministically", () => {
  const plan = planMigration({
    adminUsers: [],
    admins: [
      {
        _id: oid(60),
        user: uid(1),
        username: "legacy",
        isActive: true,
        role: oid(50),
        permissions: [
          "products.view",
          "users.manageCoaches",
          "inventory.view",
          "events.edit",
          "bogus.key",
        ],
        permissionGrants: [],
      },
    ],
    roles: [
      {
        _id: oid(50),
        name: SUPER_ADMIN_ROLE_NAME,
        systemKey: SUPER_ADMIN_SYSTEM_KEY,
        isSystem: true,
        isFullAccess: true,
      },
    ],
    existingUserIds: new Set([uhex(1)]),
  });

  const backfill = plan.grantBackfills[0];
  assert.deepEqual(backfill.grants.sort(), ["coaches.manage", "products.view"]);
  assert.deepEqual(backfill.rewritten, [
    { from: "users.manageCoaches", to: ["coaches.manage"] },
  ]);
  assert.deepEqual(backfill.dropped.map((d) => d.key), ["inventory.view"]);
  assert.deepEqual(backfill.ambiguous.map((a) => a.key), ["events.edit"]);
  assert.deepEqual(backfill.unknown, ["bogus.key"]);

  // ...ولی چون کلید مبهم/ناشناخته دارد، اجرای مهاجرت مسدود است
  assert.equal(plan.canApply, false);
});

test("AdminRole.permissions get the same deterministic treatment", () => {
  const plan = planMigration({
    adminUsers: [{ _id: uid(1), name: "علی" }],
    admins: [],
    roles: [
      {
        _id: oid(51),
        name: "مدیر محصولات",
        permissions: ["products.view", "inventory.edit", "home.edit"],
      },
    ],
    existingUserIds: new Set([uhex(1)]),
  });

  const migration = plan.roleKeyMigrations[0];
  assert.equal(migration.roleId, oid(51));
  assert.deepEqual(migration.dropped.map((d) => d.key), ["inventory.edit"]);
  assert.deepEqual(migration.rewritten.map((r) => r.from), ["home.edit"]);
  assert.ok(migration.permissions.includes("homeSlider.edit"));
  assert.ok(!migration.permissions.includes("inventory.edit"));
  assert.equal(plan.canApply, true, "بدون کلید مبهم باید قابل اجرا باشد");
});

/* ── مسدودکننده‌های واقعیِ پیش از نوشتن ────────────────────────────────── */

test("ambiguous or unknown keys anywhere block the apply", () => {
  const base = {
    adminUsers: [{ _id: uid(1), name: "علی" }],
    admins: [],
    roles: [],
    existingUserIds: new Set([uhex(1)]),
  };

  assert.equal(planMigration(base).canApply, true, "پایه باید قابل اجرا باشد");

  const roleAmbiguous = planMigration({
    ...base,
    roles: [{ _id: oid(51), name: "نقش", permissions: ["events.view"] }],
  });
  assert.equal(roleAmbiguous.canApply, false);
  assert.ok(roleAmbiguous.blockers.some((b) => b.includes("events.view")));

  for (const field of ["permissions", "permissionGrants", "permissionDenials"]) {
    const plan = planMigration({
      ...base,
      admins: [
        {
          _id: oid(60),
          user: uid(1),
          username: "x",
          isActive: true,
          [field]: ["totally.bogus"],
        },
      ],
    });
    assert.equal(plan.canApply, false, `${field} باید مسدود کند`);
    assert.ok(plan.blockers.some((b) => b.includes(field)));
  }
});

test("nothing invalid is ever planned for persistence", () => {
  const plan = planMigration({
    adminUsers: [{ _id: uid(1), name: "علی" }],
    admins: [
      {
        _id: oid(60),
        user: uid(1),
        username: "x",
        isActive: true,
        permissions: ["home.edit", "inventory.view"],
        permissionGrants: [],
      },
    ],
    roles: [{ _id: oid(51), name: "نقش", permissions: ["home.edit"] }],
    existingUserIds: new Set([uhex(1)]),
  });

  assert.deepEqual(plan.plannedInvalidKeys, []);
  const persisted = [
    ...plan.roleKeyMigrations.flatMap((r) => r.permissions),
    ...plan.grantBackfills.flatMap((b) => b.grants),
  ];
  assert.ok(persisted.length > 0);
  for (const key of persisted) {
    assert.ok(getAllPermissionKeys().includes(key), `${key} نامعتبر است`);
  }
});

test("auditUnresolvedKeys names the document and the candidates", () => {
  const blockers = auditUnresolvedKeys({
    roles: [{ _id: oid(51), name: "نقش", permissions: ["events.edit"] }],
    admins: [{ _id: oid(60), username: "u", permissions: ["ghost.key"] }],
  });
  assert.equal(blockers.length, 2);
  assert.ok(blockers[0].includes("collections.edit"));
  assert.ok(blockers[1].includes("ghost.key"));
});

test("every non-empty systemKey is preflighted, not just super-admin", () => {
  assert.deepEqual(auditSystemKeys([{ _id: oid(51), systemKey: null }]), []);

  const dup = auditSystemKeys([
    { _id: oid(51), systemKey: "auditor" },
    { _id: oid(52), systemKey: "auditor" },
  ]);
  assert.equal(dup.length, 1);
  assert.ok(dup[0].includes("auditor"));

  // رشته‌ی خالی توسط partial index ایندکس می‌شود → باید مسدود شود
  assert.equal(auditSystemKeys([{ _id: oid(51), systemKey: "" }]).length, 1);
  assert.equal(auditSystemKeys([{ _id: oid(51), systemKey: "  " }]).length, 1);
  assert.equal(auditSystemKeys([{ _id: oid(51), systemKey: " x " }]).length, 1);
  assert.equal(auditSystemKeys([{ _id: oid(51), systemKey: 42 }]).length, 1);
});

test("isFullAccess alone is never a super-role candidate", () => {
  const loose = { _id: oid(51), name: "نقش عادی", isFullAccess: true };
  const result = resolveSuperRole([loose]);
  assert.equal(result.role, null, "نباید کاندید شود");
  assert.equal(result.action, "create");
  assert.ok(
    result.blockers.some((b) => b.includes("isFullAccess")),
    "باید مسدودکننده تولید کند"
  );

  // ترکیب صریح isSystem && isFullAccess کاندید معتبر است
  const explicit = resolveSuperRole([
    { _id: oid(52), name: "x", isSystem: true, isFullAccess: true },
  ]);
  assert.equal(explicit.action, "adopt");
  assert.deepEqual(explicit.blockers, []);
});

/* ── گذارِ وضعیت عضویت (soft revoke) ──────────────────────────────────── */

test("revoking records full audit metadata and never deletes", () => {
  const now = new Date("2026-08-16T10:00:00Z");
  const { changed, patch } = applyAdminStatusTransition({
    current: { isActive: true },
    nextActive: false,
    actorUserId: "actor-1",
    reason: "  خروج از تیم  ",
    now,
  });

  assert.equal(changed, true);
  assert.equal(patch.isActive, false);
  assert.equal(patch.revokedAt, now);
  assert.equal(patch.revokedBy, "actor-1");
  assert.equal(patch.revokeReason, "خروج از تیم");
  assert.equal(patch.updatedBy, "actor-1");
  assert.ok(!("_deleted" in patch));
});

test("re-activating clears the revocation trail and stamps the actor", () => {
  const now = new Date("2026-08-16T11:00:00Z");
  const { changed, patch } = applyAdminStatusTransition({
    current: { isActive: false, revokedAt: new Date("2026-01-01"), revokedBy: "old" },
    nextActive: true,
    actorUserId: "actor-2",
    now,
  });

  assert.equal(changed, true);
  assert.equal(patch.isActive, true);
  assert.equal(patch.activatedAt, now);
  assert.equal(patch.activatedBy, "actor-2");
  assert.equal(patch.revokedAt, null);
  assert.equal(patch.revokedBy, null);
  assert.equal(patch.revokeReason, "");
  assert.equal(patch.updatedBy, "actor-2");
});

test("only real booleans move the status — \"false\" never activates", () => {
  // رگرسیون: با `!!` رشته‌ی "false" یعنی true و ادمینِ لغو‌شده فعال می‌شد.
  for (const bogus of ["false", "true", "0", 0, 1, null, {}, []]) {
    const check = validateStatusPayload({ isActive: bogus });
    assert.equal(check.ok, false, `${JSON.stringify(bogus)} باید رد شود`);
    assert.ok(check.message.includes("true یا false"));

    const transition = applyAdminStatusTransition({
      current: { isActive: false },
      nextActive: bogus,
    });
    assert.equal(transition.changed, false);
    assert.equal(transition.error, "non-boolean-status");
    assert.deepEqual(transition.patch, {});
  }

  assert.equal(validateStatusPayload({ isActive: true }).ok, true);
  assert.equal(validateStatusPayload({ isActive: false }).ok, true);
  assert.equal(validateStatusPayload({}).ok, true);
});

test("revokeReason is type- and length-bounded", () => {
  assert.equal(validateStatusPayload({ revokeReason: 123 }).ok, false);
  assert.equal(validateStatusPayload({ revokeReason: {} }).ok, false);

  const tooLong = "ا".repeat(MAX_REVOKE_REASON_LENGTH + 1);
  const rejected = validateStatusPayload({ revokeReason: tooLong });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.message.includes(String(MAX_REVOKE_REASON_LENGTH)));

  const atLimit = validateStatusPayload({
    revokeReason: `  ${"ا".repeat(MAX_REVOKE_REASON_LENGTH)}  `,
  });
  assert.equal(atLimit.ok, true, "trim باید قبل از سنجش طول اعمال شود");
  assert.equal(atLimit.revokeReason.length, MAX_REVOKE_REASON_LENGTH);

  assert.equal(validateStatusPayload({ revokeReason: null }).revokeReason, "");
  assert.equal(validateStatusPayload({}).revokeReason, "");
});

test("conditional revoke separates not-found from already-revoked", () => {
  assert.deepEqual(interpretRevokeOutcome({ updated: { _id: "a" }, exists: true }), {
    status: 200,
    outcome: "revoked",
    message: "دسترسی ادمین لغو شد",
  });

  // miss + سند موجود = از قبل لغو شده → ۲۰۰ و بدون بازنویسی
  const already = interpretRevokeOutcome({ updated: null, exists: true });
  assert.equal(already.status, 200);
  assert.equal(already.outcome, "already-revoked");

  // miss + سند ناموجود = ۴۰۴
  const missing = interpretRevokeOutcome({ updated: null, exists: false });
  assert.equal(missing.status, 404);
  assert.equal(missing.outcome, "not-found");
});

test("the scanner's branch rule rejects every way of faking the wiring", async () => {
  // اسکنر نباید با «دو فراخوانیِ نامرتبط» یا با کلیدِ ثابت فریب بخورد.
  // به‌جای اجرای کلِ اسکنر، همان قواعدش را روی نمونه‌های ساختگی می‌سنجیم —
  // قواعد باید *همه‌ی* این الگوها را رد کنند.
  const RESOLVER = "resolveUserPatchPermissions";

  const check = (body) => {
    const problems = [];
    const identityAt = body.search(/requireAdminPermission\s*\(\s*\)/);
    const assign = body.match(
      new RegExp(`(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${RESOLVER}\\s*\\(`)
    );
    if (!assign) return ["no-resolver-assignment"];
    const v = assign[1];
    if (identityAt === -1) problems.push("no-identity-gate");
    else if (identityAt > assign.index) problems.push("identity-after-resolver");

    const wiredAt = body.search(
      new RegExp(
        `requireAdminPermission\\s*\\(\\s*${v}\\.permissions\\s*,\\s*\\{[^}]*mode\\s*:\\s*${v}\\.mode`
      )
    );
    if (wiredAt === -1) problems.push("not-wired");

    const denyAt = body.search(new RegExp(`if\\s*\\(\\s*!\\s*${v}\\.allowed\\s*\\)`));
    if (denyAt === -1) problems.push("no-deny-guard");
    else if (wiredAt !== -1 && denyAt > wiredAt) problems.push("deny-after-gate");

    const literalsInGate = [
      ...body.matchAll(/requireAdminPermission\s*\(\s*["']([^"']+)["']/g),
    ];
    if (literalsInGate.length) problems.push("hardcoded-key");
    return problems;
  };

  // ✗ کلیدِ ثابت به‌جای resolver
  assert.ok(
    check(`
      const r = ${RESOLVER}(body);
      const x = await requireAdminPermission("users.edit");
    `).length > 0
  );

  // ✗ دو فراخوانیِ نامرتبط — resolver صدا زده شده ولی به گیت وصل نیست
  assert.deepEqual(
    check(`
      const r = await requireAdminPermission();
      const resolved = ${RESOLVER}(body);
      const g = await requireAdminPermission(somethingElse.permissions, { mode: "all" });
    `),
    ["not-wired", "no-deny-guard"]
  );

  // ✗ بدونِ گاردِ allowed
  assert.deepEqual(
    check(`
      await requireAdminPermission();
      const resolved = ${RESOLVER}(body);
      await requireAdminPermission(resolved.permissions, { mode: resolved.mode });
    `),
    ["no-deny-guard"]
  );

  // ✗ گاردِ allowed بعد از گیت
  assert.deepEqual(
    check(`
      await requireAdminPermission();
      const resolved = ${RESOLVER}(body);
      await requireAdminPermission(resolved.permissions, { mode: resolved.mode });
      if (!resolved.allowed) return forbidden();
    `),
    ["deny-after-gate"]
  );

  // ✗ بدونِ گیتِ هویت → ناشناس ۴۰۳ می‌گرفت نه ۴۰۱
  assert.deepEqual(
    check(`
      const resolved = ${RESOLVER}(body);
      if (!resolved.allowed) return forbidden();
      await requireAdminPermission(resolved.permissions, { mode: resolved.mode });
    `),
    ["no-identity-gate"]
  );

  // ✓ الگوی درست
  assert.deepEqual(
    check(`
      const identity = await requireAdminPermission();
      const resolved = ${RESOLVER}(body);
      if (!resolved.allowed) return forbidden();
      const { denied } = await requireAdminPermission(resolved.permissions, {
        mode: resolved.mode,
      });
    `),
    []
  );

  // و همین الگو باید در فایلِ واقعی هم برقرار باشد
  const real = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/users/[userId]/route.js"),
    "utf8"
  );
  const patch = real.slice(real.indexOf("export async function PATCH"));
  assert.deepEqual(check(patch), []);
});

test("every admins/[id] handler validates the id before querying Mongo", () => {
  // اجرای واقعیِ روت به runtime نکست + دیتابیس نیاز دارد، پس این بررسی ایستا
  // است: هر هندلر باید *قبل از* اولین کوئری، id را اعتبارسنجی کند؛ در غیر این
  // صورت idِ بدشکل CastError و ۵۰۰ می‌دهد به‌جای ۴۰۴.
  const file = path.join(
    process.cwd(),
    "src",
    "app",
    "api",
    "admin",
    "admins",
    "[id]",
    "route.js"
  );
  const source = fs.readFileSync(file, "utf8");

  assert.match(
    source,
    /import\s*\{[^}]*isValidObjectId[^}]*\}\s*from\s*["']mongoose["']/,
    "isValidObjectId باید از mongoose ایمپورت شود"
  );

  const handlers = ["GET", "PUT", "DELETE"];
  const offsets = handlers.map((name) => ({
    name,
    start: source.indexOf(`export async function ${name}(`),
  }));
  for (const handler of offsets) {
    assert.ok(handler.start > -1, `هندلر ${handler.name} پیدا نشد`);
  }
  offsets.sort((a, b) => a.start - b.start);

  for (let i = 0; i < offsets.length; i += 1) {
    const { name, start } = offsets[i];
    const end = i + 1 < offsets.length ? offsets[i + 1].start : source.length;
    const body = source.slice(start, end);

    const guardAt = body.indexOf("isValidObjectId(id)");
    assert.ok(guardAt > -1, `${name}: گاردِ isValidObjectId ندارد`);

    const queryAt = body.search(/Admin\.(findById|findOne|findOneAndUpdate|exists)\(/);
    assert.ok(queryAt > -1, `${name}: هیچ کوئری Admin ندارد؟`);
    assert.ok(
      guardAt < queryAt,
      `${name}: گارد باید قبل از اولین کوئری Admin باشد`
    );
    assert.match(body.slice(guardAt), /status:\s*404/, `${name}: باید ۴۰۴ بدهد`);
  }
});

test("status transition is idempotent — no overwrite of the original revocation", () => {
  const alreadyRevoked = {
    isActive: false,
    revokedAt: new Date("2026-01-01"),
    revokedBy: "first-actor",
    revokeReason: "دلیل اولیه",
  };
  const repeat = applyAdminStatusTransition({
    current: alreadyRevoked,
    nextActive: false,
    actorUserId: "second-actor",
    reason: "دلیل جدید",
  });
  assert.equal(repeat.changed, false);
  assert.deepEqual(repeat.patch, {}, "نباید ردپای لغو اولیه را بازنویسی کند");

  const stillActive = applyAdminStatusTransition({
    current: { isActive: true },
    nextActive: true,
    actorUserId: "x",
  });
  assert.equal(stillActive.changed, false);
  assert.deepEqual(stillActive.patch, {});
});

/* ── اعتبارسنجیِ فیلدهای متنیِ اختیاری ─────────────────────────────────── */

test("optional text fields reject non-strings instead of crashing on .trim()", () => {
  // `body.title?.trim()` روی این ورودی‌ها TypeError می‌داد → ۵۰۰
  for (const bad of [123, true, { $ne: null }, ["a"], () => {}]) {
    const result = validateOptionalText({ title: bad }, ["name", "title"]);
    assert.equal(result.ok, false, `باید رد شود: ${JSON.stringify(bad)}`);
    assert.equal(result.field, "title");
    assert.ok(result.message.includes("title"));
  }
});

test("optional text fields trim, treat null/empty as clear, and skip absent keys", () => {
  const result = validateOptionalText(
    { name: "  علی  ", title: null, email: "" },
    ["name", "title", "email", "description"]
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.values, { name: "علی", title: "", email: "" });
  assert.ok(
    !("description" in result.values),
    "فیلدی که در بدنه نیامده نباید در خروجی ساخته شود (وگرنه بی‌دلیل پاک می‌شود)"
  );

  // فقط فضای خالی = خالی، نه اینکه بی‌صدا رد شود
  assert.deepEqual(validateOptionalText({ name: "   " }, ["name"]).values, {
    name: "",
  });
});

/* ── اعتبارسنجیِ بدنه‌ی PATCH کاربر ────────────────────────────────────── */

test("user patch payload rejects the exact coercions that used to corrupt data", () => {
  // "false" با Boolean() تبدیل به true می‌شد → مسدودسازیِ ناخواسته
  for (const bad of ["false", "true", 0, 1, null, "yes"]) {
    assert.equal(
      validateUserPatchPayload({ isBanned: bad }).ok,
      false,
      `isBanned=${JSON.stringify(bad)} باید رد شود`
    );
  }

  // Number(x) || 0 هر ورودیِ نامعتبر را به صفر تبدیل می‌کرد → خالی‌شدنِ کیف پول
  for (const bad of ["abc", "", "  ", null, NaN, Infinity, -1, "-5", {}, []]) {
    assert.equal(
      validateUserPatchPayload({ walletBalance: bad }).ok,
      false,
      `walletBalance=${JSON.stringify(bad)} باید رد شود`
    );
  }

  for (const bad of [1.5, "2.5", -1, "x", null]) {
    assert.equal(
      validateUserPatchPayload({ level: bad }).ok,
      false,
      `level=${JSON.stringify(bad)} باید رد شود`
    );
  }
});

test("user patch payload accepts real booleans, numbers and the numeric strings the form sends", () => {
  const ok = validateUserPatchPayload({
    isBanned: true,
    walletBalance: "150000", // فرمِ فعلی مقدار input را خام می‌فرستد
    level: "2",
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.values, { isBanned: true, walletBalance: 150000, level: 2 });

  const zeroes = validateUserPatchPayload({
    isBanned: false,
    walletBalance: 0,
    level: 0,
  });
  assert.equal(zeroes.ok, true, "صفر مقدارِ معتبری است، نه «غایب»");
  assert.deepEqual(zeroes.values, { isBanned: false, walletBalance: 0, level: 0 });

  // فیلدِ نیامده نباید مقدار بگیرد
  assert.deepEqual(validateUserPatchPayload({}).values, {});
});

/* ── روت‌های نقش: بدون RegExpِ ساخته‌شده از ورودیِ کاربر ─────────────────── */

test("role name uniqueness never builds a RegExp from user input", () => {
  // `new RegExp(\`^${name}$\`, "i")` دو مشکل داشت: نامِ "" .* با همه‌ی
  // نقش‌ها برابر می‌شد (تزریقِ الگو) و "(a+)+$" ReDoS بود.
  for (const file of [
    "src/app/api/admin/roles/route.js",
    "src/app/api/admin/roles/[id]/route.js",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    // خطوطِ توضیح کنار گذاشته می‌شوند: نامِ الگوی حذف‌شده در توضیحِ باگ آزاد است.
    const code = source
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");

    assert.doesNotMatch(code, /new RegExp\(/, `${file}: RegExpِ پویا`);
    assert.doesNotMatch(code, /\$\{[^}]*name[^}]*\}/, `${file}: نام در الگو درون‌ریزی شده`);
    assert.ok(
      /\.collation\(\{\s*locale:\s*["']en["'],\s*strength:\s*2,?\s*\}\)/.test(code),
      `${file}: مقایسه‌ی بی‌توجه به بزرگی/کوچکی باید با collation باشد`
    );
  }
});

test("both roles/[id] handlers validate the id before querying Mongo", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/roles/[id]/route.js"),
    "utf8"
  );

  assert.match(
    source,
    /import\s*\{[^}]*isValidObjectId[^}]*\}\s*from\s*["']mongoose["']/
  );

  const offsets = ["PUT", "DELETE"]
    .map((name) => ({ name, start: source.indexOf(`export async function ${name}(`) }))
    .sort((a, b) => a.start - b.start);

  for (let i = 0; i < offsets.length; i += 1) {
    const { name, start } = offsets[i];
    assert.ok(start > -1, `هندلر ${name} پیدا نشد`);
    const end = i + 1 < offsets.length ? offsets[i + 1].start : source.length;
    const body = source.slice(start, end);

    const guardAt = body.indexOf("isValidObjectId(id)");
    const queryAt = body.search(/AdminRole\.(findById|findOne|findByIdAndDelete)\(/);
    assert.ok(guardAt > -1, `${name}: گاردِ isValidObjectId ندارد`);
    assert.ok(queryAt > -1, `${name}: هیچ کوئری AdminRole ندارد؟`);
    assert.ok(guardAt < queryAt, `${name}: گارد باید قبل از اولین کوئری باشد`);
    assert.match(body.slice(guardAt), /status:\s*404/, `${name}: باید ۴۰۴ بدهد`);
  }
});

test("admins/[id] PUT actually applies permissionGrants and permissionDenials", () => {
  // باگِ قبلی: گیت کلیدِ admins.managePermissions می‌خواست، ۲۰۰ برمی‌گرداند،
  // ولی چون فقط `body.permissions` خوانده می‌شد هیچ‌چیز تغییر نمی‌کرد.
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/admins/[id]/route.js"),
    "utf8"
  );
  const put = source.slice(
    source.indexOf("export async function PUT"),
    source.indexOf("export async function DELETE")
  );

  assert.match(put, /admin\.permissionGrants\s*=/, "grants نوشته نمی‌شود");
  assert.match(put, /admin\.permissionDenials\s*=/, "denials نوشته نمی‌شود");
  assert.match(
    put,
    /body\.permissions !== undefined && body\.permissionGrants !== undefined/,
    "فرستادنِ هم‌زمانِ دو نامِ یک چیز باید ۴۲۲ بگیرد، نه اینکه یکی بی‌صدا برنده شود"
  );
  // هر سه فیلد باید از مرزِ اعتبارسنجی رد شوند
  const grantsAt = put.indexOf("admin.permissionGrants =");
  const denialsAt = put.indexOf("admin.permissionDenials =");
  for (const [name, at] of [["grants", grantsAt], ["denials", denialsAt]]) {
    const before = put.slice(0, at);
    assert.ok(
      before.lastIndexOf("validatePermissionKeys(") > before.lastIndexOf("} catch"),
      `${name} باید بلافاصله پس از validatePermissionKeys نوشته شود`
    );
  }
});

/* ── فاز ۲: پوششِ کاملِ اسکنر ───────────────────────────────────────────────
 *
 * ملاکِ درستی، خروجیِ *خودِ اسکنر* است نه یک کپیِ دوم از منطقِ آن: هر روتِ
 * بی‌گیت، هر کلیدِ ناهم‌خوان با manifest، و هر وایرینگِ ناقصِ شاخه‌ای اینجا
 * ظاهر می‌شود.
 * ────────────────────────────────────────────────────────────────────────── */

test("the admin-auth scanner reports zero violations", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-admin-auth.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  assert.ok(output.includes("بررسی ایستا"), `اسکنر اجرا نشد:\n${output}`);

  const violations = output
    .split("\n")
    .filter((line) => line.trim().startsWith("•"))
    .map((line) => line.replace(/^\s*•\s*/, ""));

  assert.deepEqual(
    violations,
    [],
    "هر خطِ بالا یک روتِ بی‌گیت یا ناهم‌خوان با manifest است"
  );
  assert.equal(result.status, 0, "اسکنر باید با کدِ صفر خارج شود");
});

test("the price endpoint's DELETE is keyed on what it destroys, not on its path", () => {
  // این هندلر با وجود نامِ «price»، کلِ محصول و واریانت‌هایش را حذف می‌کند و
  // پیش‌تر فقط «کاربرِ واردشده» را می‌خواست.
  assert.equal(
    PUBLIC_ADMIN_API_PERMISSIONS["/product/[productId]/price"].DELETE,
    "products.delete"
  );

  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/product/[productId]/price/route.js"),
    "utf8"
  );
  const del = source.slice(source.indexOf("export async function DELETE"));
  assert.match(del, /requireAdminPermission\("products\.delete"\)/);
  assert.match(del, /Product\.findByIdAndDelete/, "اگر دیگر حذف نمی‌کند، کلید را بازبینی کن");
});

test("banner listing only needs a permission when it asks for unpublished banners", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/banners/route.js"),
    "utf8"
  );
  const get = source.slice(
    source.indexOf("export async function GET"),
    source.indexOf("export async function POST")
  );

  // ویترین نباید گیت بخورد…
  assert.match(
    get,
    /if\s*\(\s*adminMode\s*\)\s*\{\s*const\s*\{\s*denied\s*\}\s*=\s*await requireAdminPermission\("homeBanners\.edit"\)/,
    "`?admin=true` فیلترِ isActive را برمی‌دارد و باید گیت بخورد"
  );
  // …و شرطِ گیت باید پیش از هر خواندنی از دیتابیس باشد
  assert.ok(
    get.indexOf("adminMode") < get.indexOf("Banner.find"),
    "گیت باید قبل از کوئری باشد"
  );
});

test("product listing only needs a permission when it asks for unpublished products", () => {
  // همان الگوی بنرها: `?isAdmin=true` فیلترِ isActive را برمی‌دارد.
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/product/route.js"),
    "utf8"
  );

  assert.match(
    source,
    /if\s*\(\s*isAdmin\s*\)\s*\{\s*const\s*\{\s*denied\s*\}\s*=\s*await requireAdminPermission\("products\.view"\)/
  );
  assert.ok(
    source.indexOf("requireAdminPermission(\"products.view\")") <
      source.indexOf("const query = isAdmin ?"),
    "گیت باید پیش از ساختِ کوئریِ بی‌فیلتر باشد"
  );
});

test("converted catalog routes no longer use the legacy requireAdmin helper", () => {
  const files = [
    "src/app/api/admin/variants/route.js",
    "src/app/api/admin/home-sliders/route.js",
    "src/app/api/admin/home-roland-garros/route.js",
    "src/app/api/brands/create/route.js",
    "src/app/api/brands/[brandId]/route.js",
    "src/app/api/limited-editions/create/route.js",
    "src/app/api/limited-editions/[id]/route.js",
    "src/app/api/product/route.js",
    "src/app/api/product/[productId]/route.js",
    "src/app/api/product/[productId]/price/route.js",
    "src/app/api/product/[productId]/variants/route.js",
    "src/app/api/variants/[variantId]/route.js",
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.doesNotMatch(
      source,
      /from\s+["']@\/lib\/requireAdmin["']/,
      `${file}: هنوز گیتِ قدیمی را ایمپورت می‌کند`
    );
    // «هر کاربرِ واردشده» هم گیت نیست
    assert.doesNotMatch(
      source,
      /ابتدا وارد حساب کاربری شوید|لطفاً ابتدا وارد حساب کاربری خود شوید/,
      `${file}: هنوز فقط «کاربرِ واردشده» را بررسی می‌کند`
    );
  }
});

/* ── فاز ۲ / دسته‌ی ۳: سفارش، پرداخت، مالی ──────────────────────────────── */

test("site-settings wires the branch resolver exactly as the scanner demands", () => {
  // این تنها روتِ BRANCHِ این دسته است و مسیرِ نشتِ «یک endpoint، چند مالک»
  // را می‌بندد: بدون آن، دسترسیِ «پاداش نظر» حسابِ بانکی را هم می‌خواند.
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/site-settings/route.js"),
    "utf8"
  );

  const get = source.slice(
    source.indexOf("export async function GET"),
    source.indexOf("export async function PUT")
  );
  const put = source.slice(source.indexOf("export async function PUT"));

  for (const [name, body, action] of [
    ["GET", get, "view"],
    ["PUT", put, "edit"],
  ]) {
    const identityAt = body.search(/requireAdminPermission\s*\(\s*\)/);
    const resolveAt = body.indexOf(
      `resolveSiteSettingPermission(key, "${action}")`
    );
    const denyAt = body.search(/if\s*\(\s*!resolved\.allowed\s*\)\s*return forbidden\(\)/);
    const gateAt = body.search(
      /requireAdminPermission\(resolved\.permissions,\s*\{\s*mode:\s*resolved\.mode,?\s*\}\)/
    );

    assert.ok(identityAt > -1, `${name}: گیتِ هویتِ بدون آرگومان ندارد`);
    assert.ok(resolveAt > -1, `${name}: resolver با اکشنِ «${action}» صدا زده نشده`);
    assert.ok(denyAt > -1, `${name}: !resolved.allowed → forbidden() ندارد`);
    assert.ok(gateAt > -1, `${name}: گیت با خروجیِ resolver وایر نشده`);

    assert.ok(identityAt < resolveAt, `${name}: هویت باید قبل از resolver باشد`);
    assert.ok(resolveAt < denyAt, `${name}: بررسیِ allowed باید بعد از resolver باشد`);
    assert.ok(denyAt < gateAt, `${name}: بررسیِ allowed باید قبل از گیتِ کلید باشد`);
  }

  // و کلیدِ ناشناخته/غایب باید رد شود، نه اینکه به «هر ادمینی» باز باشد
  assert.equal(resolveSiteSettingPermission(null, "view").allowed, false);
  assert.equal(resolveSiteSettingPermission("", "view").allowed, false);
  assert.equal(resolveSiteSettingPermission("__proto__", "view").allowed, false);
  assert.equal(resolveSiteSettingPermission("bank_account_details", "delete").allowed, false);
  assert.deepEqual(
    resolveSiteSettingPermission("bank_account_details", "view").permissions,
    ["bankAccount.view"]
  );
});

test("every site-setting key the admin UI actually requests has an owner", () => {
  // اگر کلیدی در UI اضافه شود ولی در SITE_SETTING_OWNERS نه، آن صفحه ۴۰۳
  // می‌گیرد. این تست همان واگرایی را می‌گیرد.
  const used = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(jsx?|mjs)$/.test(entry.name)) {
        const src = fs.readFileSync(p, "utf8");
        for (const m of src.matchAll(/site-settings\?key=\$\{(\w+)\}/g)) {
          // نامِ ثابتِ محلی → مقدارش را از همان فایل بخوان
          const decl = src.match(
            new RegExp(`${m[1]}\\s*=\\s*["']([a-z0-9_]+)["']`, "i")
          );
          if (decl) used.add(decl[1]);
        }
        for (const m of src.matchAll(/site-settings\?key=([a-z0-9_]+)/g)) {
          used.add(m[1]);
        }
      }
    }
  };
  walk(path.join(process.cwd(), "src", "components", "admin"));

  // آستانه فقط محافظ است در برابرِ «اسکنر هیچ پیدا نکرد و تست بی‌صدا سبز شد».
  // کاملِ کلیدها را نمی‌بیند (بعضی ثابت‌ها از ماژول دیگری import می‌شوند)؛
  // ارزشِ تست، بررسیِ مالک‌داشتنِ کلیدهای پیداشده است.
  assert.ok(used.size >= 3, `کلیدی پیدا نشد؟ ${[...used]}`);
  for (const key of used) {
    assert.ok(
      key in SITE_SETTING_OWNERS,
      `کلید «${key}» در UI استفاده می‌شود ولی مالکی در SITE_SETTING_OWNERS ندارد`
    );
  }
});

test("financial routes keep distinct keys — viewing is not approving", () => {
  // یک کلیدِ درشت برای کلِ «مالی» یعنی هرکس بتواند رسید بانکی را تأیید کند.
  const m = ADMIN_API_PERMISSIONS;
  assert.equal(m["/admin/payments/[id]/approve"].POST, "payments.approve");
  assert.equal(m["/admin/payments/[id]/reject"].POST, "payments.reject");
  assert.equal(m["/admin/payments/[id]/edit"].PATCH, "payments.edit");
  assert.notEqual(m["/admin/orders/[orderId]"].GET, m["/admin/orders/[orderId]"].PATCH);
  assert.equal(m["/admin/orders/[orderId]/items"].DELETE, "orders.editItems");
  assert.equal(m["/admin/orders/[orderId]/discount"].POST, "orders.adjustDiscount");
  assert.equal(m["/admin/orders/[orderId]/eur"].PUT, "orders.setCurrency");
  assert.equal(m["/admin/orders/[orderId]/tracking"].GET, "orderTracking.view");
  assert.equal(m["/admin/orders/[orderId]/tracking"].POST, "orderTracking.assign");
  assert.equal(
    m["/admin/installments/[id]/confirm-order"].POST,
    "installments.approveCheck"
  );

  // و همه‌شان باید کلیدِ واقعیِ رجیستری باشند
  const registry = new Set(getAllPermissionKeys());
  for (const route of Object.keys(m)) {
    for (const value of Object.values(m[route])) {
      if (value === null || isBranch(value)) continue;
      for (const key of Array.isArray(value) ? value : value.any || [value]) {
        assert.ok(registry.has(key), `کلیدِ ناموجود در رجیستری: ${key} (${route})`);
      }
    }
  }
});

test("the audit trail still records the acting admin after the gate swap", () => {
  // گیتِ قدیمی خروجی‌اش را دوباره از دیتابیس می‌خواند؛ حالا `actor` از خودِ
  // گیت می‌آید. اگر کسی `actor:` را حذف کند، `admin.userId` روی undefined
  // می‌افتد و ردپای ممیزی بی‌صدا خالی می‌شود.
  const files = [
    "src/app/api/admin/orders/[orderId]/route.js",
    "src/app/api/admin/orders/[orderId]/items/route.js",
    "src/app/api/admin/orders/[orderId]/discount/route.js",
    "src/app/api/admin/orders/[orderId]/eur/route.js",
    "src/app/api/admin/orders/[orderId]/tracking/route.js",
    "src/app/api/admin/orders/used-product-tracking/route.js",
    "src/app/api/admin/payments/[id]/approve/route.js",
    "src/app/api/admin/payments/[id]/reject/route.js",
    "src/app/api/admin/payments/[id]/edit/route.js",
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(
      source,
      /admin\.userId/,
      `${file}: دیگر هیچ ردپای ممیزی نمی‌نویسد؟ تست را به‌روز کن`
    );
    assert.match(
      source,
      /const \{ actor: admin, denied \} = await requireAdminPermission\(/,
      `${file}: admin باید از خروجیِ گیت بیاید`
    );
    assert.doesNotMatch(
      source,
      /async function getAdminUser/,
      `${file}: wrapperِ دومِ کوئریِ ادمین باید حذف شده باشد`
    );
  }
});

/* ── فاز ۲ / دسته‌ی ۴: محتوا، کمپین، افراد، پشتیبانی ───────────────────── */

test("every handler under /api/admin now goes through the permission gate", () => {
  // نقطه‌عطفِ فاز ۲: از اینجا به بعد «فایلِ جدید بدون گیت» یک رگرسیون است،
  // نه بدهیِ باقی‌مانده. تنها استثناها روت‌های بیرونیِ manifest اند.
  const walk = (dir, out = []) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p, out);
      else if (entry.name === "route.js") out.push(p);
    }
    return out;
  };

  const files = walk(path.join(process.cwd(), "src", "app", "api", "admin"));
  assert.ok(files.length > 70, `فقط ${files.length} فایل؟ مسیر عوض شده است`);

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const rel = path.relative(process.cwd(), file).split(path.sep).join("/");

    assert.match(
      source,
      /from ["']@\/lib\/requireAdminPermission["']/,
      `${rel}: گیتِ دسترسی را ایمپورت نمی‌کند`
    );
    assert.doesNotMatch(
      source,
      /from ["']@\/lib\/requireAdmin["']/,
      `${rel}: هنوز گیتِ legacy را ایمپورت می‌کند`
    );
  }
});

test("content and taxonomy keep view separate from write", () => {
  const m = ADMIN_API_PERMISSIONS;

  assert.equal(m["/admin/articles"].GET, "articles.view");
  assert.equal(m["/admin/articles"].POST, "articles.create");
  assert.equal(m["/admin/articles/[id]"].DELETE, "articles.delete");
  // autosave یک ویرایشِ کامل است، نه یک «ذخیره‌ی موقتِ بی‌خطر»
  assert.equal(m["/admin/article-cms/[id]/autosave"].PATCH, "articles.edit");
  // duplicate یک مقاله‌ی *جدید* می‌سازد
  assert.equal(m["/admin/article-cms/[id]/duplicate"].POST, "articles.create");
  assert.notEqual(
    m["/admin/article-categories"].GET,
    m["/admin/article-categories"].POST
  );
  // انتشار کمپین کلیدِ خودش را دارد؛ با ویرایش یکی نیست
  assert.equal(m["/admin/events/[id]/status"].PUT, "collections.publish");
  assert.notEqual(m["/admin/events/[id]"].PUT, m["/admin/events/[id]/status"].PUT);
});

test("support and coach money paths are not folded into a single view key", () => {
  const m = ADMIN_API_PERMISSIONS;

  // شارژِ کیف پول مربی پول واقعی جابه‌جا می‌کند
  assert.equal(m["/admin/coaches/[coachId]/wallet"].POST, "coaches.manageCredits");
  assert.notEqual(m["/admin/coaches"].GET, m["/admin/coaches/[coachId]/wallet"].POST);
  // تأییدِ درخواستِ مربیگری نقشِ کاربر را ارتقا می‌دهد
  assert.equal(m["/admin/coach-applications/[id]/review"].PUT, "coaches.manage");
  // پاسخ به تیکت با بستنِ تیکت یکی نیست
  assert.notEqual(m["/admin/tickets/[id]"].PATCH, m["/admin/tickets/[id]/messages"].POST);
  assert.equal(m["/admin/tickets/[id]/messages"].POST, "tickets.reply");
  assert.equal(m["/admin/comments/[id]"].PATCH, "comments.moderate");
  assert.equal(m["/admin/comments/[id]"].DELETE, "comments.delete");
});

test("article routes no longer answer 401 for an authenticated non-permitted admin", () => {
  // الگوی قدیمی همه‌ی ردها را ۴۰۱ می‌کرد (unauthorizedResponse). حالا تمایزِ
  // ۴۰۱/۴۰۳ در خودِ گیت است و آن helper نباید در این فایل‌ها بماند.
  const files = [
    "src/app/api/admin/articles/route.js",
    "src/app/api/admin/articles/[id]/route.js",
    "src/app/api/admin/articles/[id]/revisions/route.js",
    "src/app/api/admin/article-cms/route.js",
    "src/app/api/admin/article-cms/entities/route.js",
    "src/app/api/admin/article-cms/[id]/autosave/route.js",
    "src/app/api/admin/article-cms/[id]/duplicate/route.js",
    "src/app/api/admin/article-cms/[id]/restore/route.js",
    "src/app/api/admin/article-cms/[id]/revisions/[revision]/route.js",
    "src/app/api/admin/article-categories/route.js",
    "src/app/api/admin/article-categories/[id]/route.js",
    "src/app/api/admin/article-tags/route.js",
    "src/app/api/admin/article-tags/[id]/route.js",
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.doesNotMatch(source, /unauthorizedResponse/, `${file}: هنوز ۴۰۱ ثابت می‌دهد`);
    // و هرجا نویسنده/ویرایشگر ثبت می‌شود، باید از خروجیِ گیت بیاید
    if (/admin\._id/.test(source)) {
      assert.match(
        source,
        /const \{ actor: admin, denied \} = await requireAdminPermission\(/,
        `${file}: admin._id بدون گرفتنِ actor از گیت استفاده شده`
      );
    }
  }
});

/* ── فاز ۲ / دسته‌ی ۵: آخرین روت‌های بیرون از /api/admin ────────────────── */

test("the ban audit trail cannot be forged from the request body", () => {
  // پیش‌تر `bannedBy` از بدنه خوانده می‌شد: هر فراخوانی می‌توانست مسدودسازی را
  // به نامِ ادمینِ دیگری ثبت کند (و کل روت هم بدون احراز هویت باز بود).
  for (const file of ["src/app/api/bans/route.js", "src/app/api/bans/[id]/route.js"]) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(source, /bannedBy:\s*actor\.userId/, `${file}: bannedBy از گیت نمی‌آید`);
    assert.doesNotMatch(
      source,
      /const \{[^}]*\bbannedBy\b[^}]*\} = body/,
      `${file}: bannedBy هنوز از بدنه خوانده می‌شود`
    );
  }
});

test("dynamic ban/otp handlers await params instead of reading a Promise", () => {
  // `const { id } = params` روی Promise مقدار undefined می‌داد؛ گیت گذاشتن روی
  // هندلری که اصلاً کار نمی‌کند، امنیتِ نمایشی است.
  for (const file of [
    "src/app/api/bans/[id]/route.js",
    "src/app/api/otps/[id]/route.js",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.doesNotMatch(source, /const \{ id \} = params;/, `${file}: params await نشده`);
    assert.equal(
      (source.match(/const \{ id \} = await params;/g) || []).length,
      3,
      `${file}: هر سه هندلر باید params را await کنند`
    );
  }
});

test("the otp back door is closed on every method and still marked for deletion", () => {
  // GET همه‌ی کدهای یک‌بارمصرف را برمی‌گرداند و POST برای هر شماره کد می‌سازد؛
  // یعنی ورود به هر حساب. تا زمان حذف، همه‌ی متدها پشتِ بالاترین کلید بسته‌اند.
  const collection = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/otps/route.js"),
    "utf8"
  );
  const detail = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/otps/[id]/route.js"),
    "utf8"
  );

  for (const [name, source, count] of [
    ["otps", collection, 2],
    ["otps/[id]", detail, 3],
  ]) {
    assert.equal(
      (source.match(/requireAdminPermission\("admins\.managePermissions"\)/g) || []).length,
      count,
      `${name}: همه‌ی متدها باید گیت داشته باشند`
    );
  }

  // هر متدِ موجود در فایل باید در manifest هم ثبت شده باشد — از جمله GETِ تکی
  assert.deepEqual(Object.keys(PUBLIC_ADMIN_API_PERMISSIONS["/otps/[id]"]).sort(), [
    "DELETE",
    "GET",
    "PUT",
  ]);
  assert.deepEqual(Object.keys(PUBLIC_ADMIN_API_PERMISSIONS["/bans/[id]"]).sort(), [
    "DELETE",
    "GET",
    "PUT",
  ]);

  // یادداشتِ حذف نباید بی‌صدا پاک شود
  assert.match(collection, /حذف/, "توصیه‌ی حذفِ این روت باید در فایل بماند");
});

test("public storefront reads stay public while their admin twins are gated", () => {
  // مرزِ حساس: گیت گذاشتن روی این GETها ویترین را می‌شکست.
  const navbar = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/navbar/route.js"),
    "utf8"
  );
  const get = navbar.slice(
    navbar.indexOf("export async function GET"),
    navbar.indexOf("export async function POST")
  );
  const post = navbar.slice(navbar.indexOf("export async function POST"));

  assert.doesNotMatch(get, /requireAdminPermission/, "GET نوبار عمومی است");
  assert.match(post, /requireAdminPermission\("navbar\.revalidate"\)/);

  for (const file of [
    "src/app/api/ai/product-draft/route.js",
    "src/app/api/ai/athlete-prompt/route.js",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(source, /requireAdminPermission\("ai\.\w+"\)/, `${file}: بدون گیت`);
  }
});

/* ── فاز ۳: عضویتِ ادمین به کاربر گره خورد ─────────────────────────────── */

test("admin identity is derived from the user, never typed by hand", () => {
  const user = { _id: "507f1f77bcf86cd799439011", name: "علی", lastName: "محمدی" };

  assert.equal(deriveDisplayName(user), "علی محمدی");
  assert.equal(deriveDisplayName({ phone: "09120000000" }), "09120000000");
  assert.equal(deriveDisplayName({ email: "a@b.c" }), "a@b.c");
  assert.equal(deriveDisplayName({}), "ادمین");
  assert.equal(deriveDisplayName(null), "ادمین");

  // از _id ساخته می‌شود: پایدار، بدون داده‌ی شخصی، و همیشه با الگوی username
  const username = deriveUsername(user, new Set());
  assert.equal(username, "admin-99439011");
  assert.match(username, /^[a-z0-9_.-]{3,30}$/);
  assert.equal(deriveUsername(user, new Set()), username, "باید قطعی باشد");
  assert.equal(deriveUsername(user, new Set([username])), `${username}-2`);
  assert.equal(
    deriveUsername(user, new Set([username, `${username}-2`])),
    `${username}-3`
  );
});

test("identity fields are no longer accepted by the admin PATCH resolver", () => {
  // فرستادنشان باید fail-closed باشد، نه اینکه بی‌صدا نادیده گرفته شود.
  for (const field of ["name", "username", "email"]) {
    const result = resolveAdminPatchPermissions({ [field]: "x" });
    assert.equal(result.allowed, false, `${field} هنوز پذیرفته می‌شود`);
    assert.equal(result.reason, `unknown-field:${field}`);
  }

  // تنها متنِ آزادِ باقی‌مانده
  const ok = resolveAdminPatchPermissions({ title: "مدیر فروش" });
  assert.equal(ok.allowed, true);
  assert.deepEqual(ok.permissions, ["admins.edit"]);
});

test("creating an admin requires a real user and never touches their business role", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/admins/route.js"),
    "utf8"
  );
  const post = source.slice(source.indexOf("export async function POST"));

  assert.match(post, /isValidObjectId\(userId\)/, "userId اعتبارسنجی نمی‌شود");
  assert.match(post, /User\.findById\(userId\)/, "کاربر خوانده نمی‌شود");
  assert.match(post, /user:\s*user\._id/, "عضویت به کاربر لینک نمی‌شود");
  assert.match(post, /deriveDisplayName\(user\)/);
  assert.match(post, /deriveUsername\(user,/);

  // کاربرِ مسدود عضویتِ مرده می‌سازد
  assert.match(post, /user\.isBanned/, "کاربر مسدود رد نمی‌شود");

  // نقشِ کسب‌وکاریِ کاربر نباید عوض شود
  assert.doesNotMatch(post, /User\.(updateOne|findByIdAndUpdate)/);
  assert.doesNotMatch(post, /user\.role\s*=/);

  // و هیچ هویتی دیگر از بدنه خوانده نمی‌شود
  assert.doesNotMatch(
    post,
    /validateOptionalText\(body,\s*\[[^\]]*"username"/,
    "username هنوز از بدنه خوانده می‌شود"
  );
});

test("a duplicate membership is a 409 that points at the existing one", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/admins/route.js"),
    "utf8"
  );
  const post = source.slice(source.indexOf("export async function POST"));

  // بررسیِ خوش‌بینانه — با adminId تا UI بتواند به ویرایش هدایت کند
  assert.match(post, /Admin\.findOne\(\{ user: user\._id \}\)/);
  assert.match(post, /adminId:\s*existing\._id/);

  // و مسابقه‌ی واقعی: ایندکسِ یکتای partial باید به همان ۴۰۹ نگاشت شود
  assert.match(post, /error\.code === 11000/);
  assert.match(post, /error\.keyPattern\?\.user|admin_user_unique/);
});

test("the user picker is gated on creating admins, not on browsing users", () => {
  assert.equal(ADMIN_API_PERMISSIONS["/admin/admins/candidates"].GET, "admins.create");

  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/admins/candidates/route.js"),
    "utf8"
  );
  assert.match(source, /requireAdminPermission\("admins\.create"\)/);

  // ورودیِ جست‌وجو نباید مستقیم به RegExp برود (ReDoS/تزریقِ الگو)
  assert.doesNotMatch(
    source,
    /\$regex:\s*search/,
    "ورودیِ خام نباید به $regex برود"
  );
  // این روت دیگر خودش regex نمی‌سازد؛ از جست‌وجوی مشترک استفاده می‌کند که
  // ورودی را توکن می‌کند و هر چیزی جز حرف و رقم را دور می‌ریزد. پس به‌جای
  // بررسیِ خطِ escapeِ قدیمی، خودِ خاصیت آزموده می‌شود.
  assert.doesNotMatch(source, /new RegExp\(/, "روت نباید مستقیم RegExp بسازد");
  assert.match(source, /withSearch\(\{\}, search, \[/, "باید از جست‌وجوی مشترک استفاده کند");
  for (const clause of buildSearchFilter("(a+)+$ .* [[[ ^x", ["name"]).$and) {
    assert.match(
      clause.name.$regex,
      /^[\p{L}\p{N}[\]]+$/u,
      `متاکاراکتر به الگو نشت کرده: ${clause.name.$regex}`
    );
  }

  // صفحه‌بندیِ واقعی با سقفِ سخت
  assert.match(source, /Math\.min\(\s*MAX_LIMIT/);
  assert.match(source, /\.skip\(\(page - 1\) \* limit\)/);
});

test("the user-detail role editor no longer offers 'admin'", () => {
  const page = fs.readFileSync(
    path.join(process.cwd(), "src/app/(Admin-Panel)/p-admin/users/[userId]/page.jsx"),
    "utf8"
  );
  const options = page.slice(
    page.indexOf("const roleOptions"),
    page.indexOf("const levelLabels")
  );
  assert.doesNotMatch(options, /value:\s*'admin'/, "گزینه‌ی «مدیر کل» هنوز هست");

  // و لایه‌ی دومِ همان قاعده سمتِ سرور
  assert.equal(resolveUserPatchPermissions({ role: "admin" }).allowed, false);
  assert.equal(resolveUserPatchPermissions({ role: "coach" }).allowed, true);
});

test("the admin form sends only server-accepted fields", () => {
  const form = fs.readFileSync(
    path.join(process.cwd(), "src/components/admin/admins/AdminForm.jsx"),
    "utf8"
  );

  // ورودیِ متنیِ هویت باید حذف شده باشد
  for (const gone of ["updateField('name'", "updateField('username'", "updateField('email'"]) {
    assert.ok(!form.includes(gone), `فرم هنوز ${gone} دارد`);
  }

  // و payload باید صریح باشد، نه اسپردِ کلِ formData
  assert.doesNotMatch(form, /body: JSON\.stringify\(\{\s*\.\.\.formData/);
  // حالتِ ساخت: کاربرِ متصل بخشی از payload است (فاز ۵ آن را به شاخه‌ی create برد)
  assert.match(form, /userId: linkedUser\._id/);
});

/* ───────────────────────────────────────────────────────────────────────────
 * فاز ۴ — UI و نگهبانِ ناوبری
 * ─────────────────────────────────────────────────────────────────────────── */

const ADMIN_PAGES_ROOT = path.join(process.cwd(), "src/app/(Admin-Panel)/p-admin");

/** صفحه‌هایی که عمداً در manifest نیستند (مقصدِ rewrite ـِ نگهبان). */
const UNGATED_ADMIN_PAGES = new Set(["/p-admin/403"]);

function listAdminPageRoutes(dir = ADMIN_PAGES_ROOT, route = "/p-admin") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      out.push(...listAdminPageRoutes(path.join(dir, entry.name), `${route}/${entry.name}`));
    } else if (/^page\.(jsx?|tsx?)$/.test(entry.name)) {
      out.push(route);
    }
  }
  return out;
}

test("every admin page has a manifest entry and every entry has a page", () => {
  const onDisk = new Set(listAdminPageRoutes().filter((r) => !UNGATED_ADMIN_PAGES.has(r)));
  const inManifest = new Set(Object.keys(ADMIN_ROUTE_PERMISSIONS));

  const missing = [...onDisk].filter((r) => !inManifest.has(r));
  const stale = [...inManifest].filter((r) => !onDisk.has(r));

  // یک صفحه‌ی بدونِ ورودیِ manifest برای *همه* بسته می‌شود (fail-closed در
  // middleware)، و یک ورودیِ بی‌صفحه یعنی manifest از واقعیت عقب افتاده.
  assert.deepEqual(missing, [], "صفحه‌های بدونِ ورودیِ manifest");
  assert.deepEqual(stale, [], "ورودی‌های manifest بدونِ صفحه");
});

test("a full-access admin can open every admin page", () => {
  const all = getAllPermissionKeys();
  const blocked = listAdminPageRoutes()
    .filter((r) => !UNGATED_ADMIN_PAGES.has(r))
    .filter((r) => !canAccessAdminRoute(all, r));
  assert.deepEqual(blocked, [], "دسترسیِ کامل نباید هیچ صفحه‌ای را از دست بدهد");
});

test("the deny page is deliberately outside the manifest and cannot loop", () => {
  const middleware = fs.readFileSync(path.join(process.cwd(), "src/middleware.js"), "utf8");

  assert.match(middleware, /const DENIED_PATH = "\/p-admin\/403"/);
  // بدونِ این شرط، rewrite به صفحه‌ای که خودش در manifest نیست حلقه می‌سازد.
  assert.match(
    middleware,
    /if \(pathname === DENIED_PATH\) return NextResponse\.next\(\)/,
    "مسیرِ ۴۰۳ از ارزیابی کنار گذاشته نشده"
  );
  assert.equal(ADMIN_ROUTE_PERMISSIONS["/p-admin/403"], undefined);
  assert.ok(fs.existsSync(path.join(ADMIN_PAGES_ROOT, "403/page.jsx")), "صفحه‌ی ۴۰۳ وجود ندارد");
});

test("the navigation guard reads live membership, not the JWT role claim", () => {
  const middleware = fs.readFileSync(path.join(process.cwd(), "src/middleware.js"), "utf8");
  // کامنت‌ها کنار می‌روند: خودِ توضیحِ «این چک حذف شد» وگرنه match می‌شود.
  const code = middleware.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  // چکِ قدیمی هر ادمینِ عضویتی را که User.role اش «admin» نیست قفلِ بیرون می‌کرد.
  assert.doesNotMatch(code, /payload\.role/, "چکِ نقشِ داخلِ JWT هنوز هست");
  assert.doesNotMatch(code, /verifyToken/, "middleware هنوز به ادعای JWT تکیه می‌کند");
  assert.match(middleware, /getAdminContext\(\{ token \}\)/);
  assert.match(middleware, /canAccessAdminRoute\(ctx\.permissions, pathname \+ search\)/);
  assert.match(middleware, /runtime: "nodejs"/, "کوئریِ mongoose در runtime لبه کار نمی‌کند");
  assert.match(middleware, /matcher: \["\/p-user\/:path\*", "\/p-admin\/:path\*"\]/);
});

test("resolveAdminContext never imports next/headers statically", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/lib/adminContext.js"), "utf8");
  // import ایستا این ماژول را در middleware غیرقابل بارگذاری می‌کند.
  assert.doesNotMatch(source, /^import .*next\/headers/m);
  assert.match(source, /await import\("next\/headers"\)/);
  assert.match(source, /resolveAdminContext\(\{ token: explicitToken \} = \{\}\)/);
});

test("the client permission source fails closed outside its provider", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/admin/AdminPermissionProvider.jsx"),
    "utf8"
  );
  const denyAll = source.slice(
    source.indexOf("const DENY_ALL"),
    source.indexOf("export function AdminPermissionProvider")
  );
  assert.match(denyAll, /can: \(\) => false/);
  assert.match(denyAll, /canRoute: \(\) => false/);
  assert.match(source, /useContext\(AdminPermissionContext\) \|\| DENY_ALL/);

  // همان توابعِ رجیستری، نه یک کپیِ موازی
  assert.match(source, /from "@\/lib\/permissions"/);
  assert.match(source, /canAccessAdminRoute\(permissionSet, route\)/);
  assert.match(source, /hasPermission\(permissionSet, required, options\)/);
});

test("permissions are resolved on the server so there is no hydration flash", () => {
  const layout = fs.readFileSync(path.join(ADMIN_PAGES_ROOT, "layout.jsx"), "utf8");
  assert.doesNotMatch(layout, /^\s*["']use client["']/m);
  assert.match(layout, /const ctx = await getAdminContext\(\)/);
  assert.match(layout, /permissions=\{ctx\.permissions\}/);
  // نشستِ غیرادمین نباید چرومِ پنل (سایدبار/زنگوله) بگیرد
  assert.match(layout, /if \(!ctx\) \{/);
});

test("the sidebar and dashboard shortcuts point at real manifest routes", () => {
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  const hrefs = new Set();

  for (const source of [
    read("src/components/admin/Layout.jsx"),
    read("src/app/(Admin-Panel)/p-admin/page.jsx"),
  ]) {
    for (const m of source.matchAll(/["'](\/p-admin[^"'?#]*)["']/g)) hrefs.add(m[1]);
  }

  const unknown = [...hrefs].filter(
    (href) => !UNGATED_ADMIN_PAGES.has(href) && !ADMIN_ROUTE_PERMISSIONS[href]
  );
  // لینکی که در manifest نیست همیشه پنهان می‌ماند — یعنی مرده است.
  assert.deepEqual(unknown, [], "لینکِ ناوبری خارج از manifest");
});

test("navigation arrays are filtered before render, not disabled in place", () => {
  const layout = fs.readFileSync(path.join(process.cwd(), "src/components/admin/Layout.jsx"), "utf8");
  assert.match(layout, /const visibleMenu = menuItems\.filter\(\(item\) => canRoute\(item\.href\)\)/);
  assert.match(layout, /\{visibleMenu\.map\(/);
  assert.doesNotMatch(layout, /\{menuItems\.map\(/, "هنوز از فهرستِ فیلترنشده رندر می‌شود");

  const dashboard = fs.readFileSync(path.join(ADMIN_PAGES_ROOT, "page.jsx"), "utf8");
  assert.match(dashboard, /\]\.filter\(\(item\) => canRoute\(item\.href\)\)/);
  assert.match(dashboard, /canRoute\('\/p-admin\/admin-products'\) && \(/);
  assert.match(dashboard, /canRoute\('\/p-admin\/admin-athletes'\) && \(/);
});

test("soft navigation into a forbidden page still hides its content", () => {
  const layout = fs.readFileSync(path.join(process.cwd(), "src/components/admin/Layout.jsx"), "utf8");
  assert.match(layout, /const routeAllowed = pathname === "\/p-admin\/403" \|\| canRoute\(pathname\)/);
  assert.match(layout, /\{routeAllowed \? children : <ForbiddenNotice reason="forbidden" \/>\}/);
});

test("a limited role sees only its own sidebar entries", () => {
  // ادمینِ مقالات: نه محصولی، نه سفارشی، نه کاربری.
  const articleAdmin = computeEffectivePermissions({
    rolePermissions: ["dashboard.view", "articles.view", "articles.edit"],
  });

  assert.equal(canAccessAdminRoute(articleAdmin, "/p-admin"), true);
  assert.equal(canAccessAdminRoute(articleAdmin, "/p-admin/admin-articles"), true);
  assert.equal(canAccessAdminRoute(articleAdmin, "/p-admin/admin-products"), false);
  assert.equal(canAccessAdminRoute(articleAdmin, "/p-admin/admin-orders"), false);
  assert.equal(canAccessAdminRoute(articleAdmin, "/p-admin/users/admins"), false);

  // و سایدبار دقیقاً همان‌ها را نشان می‌دهد
  const visible = getVisibleSections(articleAdmin).map((s) => s.key);
  assert.ok(visible.includes("articles"));
  assert.ok(!visible.includes("products"));
});

test("an unknown or ambiguous admin URL is denied, never defaulted open", () => {
  const all = getAllPermissionKeys();
  assert.equal(canAccessAdminRoute(all, "/p-admin/does-not-exist"), false);
  assert.equal(canAccessAdminRoute(all, "/p-admin/support?tab=zzz"), false);
  assert.equal(canAccessAdminRoute(all, "/p-admin/support?tab=tickets&tab=comments"), false);
  assert.equal(canAccessAdminRoute([], "/p-admin"), false);
});

test("hub tabs are filtered and the default tab is one the admin may open", () => {
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

  for (const [file, hub] of [
    ["src/app/(Admin-Panel)/p-admin/support/page.jsx", "/p-admin/support"],
    ["src/app/(Admin-Panel)/p-admin/admin-pages/page.jsx", "/p-admin/admin-pages"],
  ]) {
    const source = read(file);
    // همان manifestِ تب — نه یک نگاشتِ موازیِ محلی
    assert.match(source, /ADMIN_TAB_PERMISSIONS\[`\S+\?tab=\$\{value\}`\]/, `${file}: نگاشتِ تب محلی است`);
    assert.match(source, /Array\.isArray\(keys\) && keys\.length > 0 && can\(keys\)/, `${file}: آرایه‌ی خالی «مجاز» خوانده می‌شود`);
    assert.match(source, /\.filter\(\(t\) => allows\(t\.value\)\)/, `${file}: فهرستِ تب فیلتر نمی‌شود`);
    assert.match(source, /ORDER\.find\(allows\) \|\| null/, `${file}: تبِ پیش‌فرض بدونِ بررسیِ دسترسی است`);

    // هر تبِ صریح باید در manifest باشد وگرنه همیشه پنهان می‌ماند
    for (const m of source.matchAll(/value: "([a-z-]+)"/g)) {
      assert.ok(
        ADMIN_TAB_PERMISSIONS[`${hub}?tab=${m[1]}`],
        `${file}: تبِ «${m[1]}» در ADMIN_TAB_PERMISSIONS نیست`
      );
    }
  }

  // صفحه‌ی محتوایی نباید به‌عنوان else ی تبِ صفحه‌ی اصلی رندر شود
  const pages = read("src/app/(Admin-Panel)/p-admin/admin-pages/page.jsx");
  assert.doesNotMatch(pages, /tab === "home" \? <HomeSectionsPanel \/> : <PagesList \/>/);
  assert.match(pages, /\{tab === "content" && <PagesList \/>\}/);
});

test("the financial tabs and shortcuts carry real permission keys", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/(Admin-Panel)/p-admin/financial/page.jsx"),
    "utf8"
  );

  const keys = [...source.matchAll(/permission: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(keys, [
    "bankAccount.view",
    "exchangeRate.view",
    "financingSettings.view",
    "reviewCredit.view",
  ]);

  const valid = new Set(getAllPermissionKeys());
  for (const key of keys) assert.ok(valid.has(key), `کلیدِ ناشناخته: ${key}`);

  // و همان کلیدها باید کلیدهای «any» ـِ روتِ مالی باشند (زیرمجموعه)
  const routeKeys = new Set(ADMIN_ROUTE_PERMISSIONS["/p-admin/financial"]);
  for (const key of keys) assert.ok(routeKeys.has(key), `${key} در نگاشتِ روتِ مالی نیست`);

  assert.match(source, /const tabs = TABS\.filter\(\(t\) => can\(t\.permission\)\)/);
  assert.match(source, /const links = EXTERNAL_LINKS\.filter\(\(l\) => canRoute\(l\.href\)\)/);
  assert.match(source, /useState\(\(\) => tabs\[0\]\?\.value \|\| null\)/);
  assert.match(source, /<SectionTabs tabs=\{tabs\}/);
});

test("home-section shortcuts are filtered by route permission", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/(Admin-Panel)/p-admin/admin-pages/page.jsx"),
    "utf8"
  );
  assert.match(source, /HOME_SECTIONS\.filter\(\(sec\) => sec\.disabled \|\| canRoute\(sec\.href\)\)/);
  assert.match(source, /\{sections\.map\(/);

  // و هر href واقعی باید روتِ شناخته‌شده باشد
  const hrefs = [...source.matchAll(/href: "(\/p-admin[^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 5);
  for (const href of hrefs) {
    assert.ok(ADMIN_ROUTE_PERMISSIONS[href], `${href} در manifest نیست`);
  }
});

/* ───────────────────────────────────────────────────────────────────────────
 * فاز ۴ — بچ ۲: اکشن‌های صفحه (کاتالوگ)
 * ─────────────────────────────────────────────────────────────────────────── */

/** همه‌ی فایل‌های .js/.jsx زیر src/app و src/components. */
function listSourceFiles() {
  const roots = [path.join(process.cwd(), "src/app"), path.join(process.cwd(), "src/components")];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jsx?|tsx?)$/.test(entry.name)) out.push(full);
    }
  };
  roots.forEach(walk);
  return out;
}

const SOURCE_FILES = listSourceFiles();
const rel = (file) => path.relative(process.cwd(), file).replace(/\\/g, "/");

test("every UI permission gate uses a key that exists in the registry", () => {
  const valid = new Set(getAllPermissionKeys());
  const bad = [];

  for (const file of SOURCE_FILES) {
    // کامنت‌ها کنار می‌روند: مثالِ can(["a","b"]) در داکِ Provider وگرنه
    // به‌عنوان کلیدِ واقعی خوانده می‌شد.
    const source = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    // can("a.b") و can(["a.b", "c.d"]) — هر دو شکل
    for (const m of source.matchAll(/\bcan\(\s*(\[[^\]]*\]|["'][^"']+["'])/g)) {
      for (const key of m[1].match(/["']([^"']+)["']/g) || []) {
        const clean = key.slice(1, -1);
        // شناسه‌های ساختگیِ داخلِ تست‌های واحد کنار گذاشته نمی‌شوند چون این
        // اسکن فقط src را می‌بیند، نه tests.
        if (!valid.has(clean)) bad.push(`${rel(file)} → ${clean}`);
      }
    }
  }

  assert.deepEqual(bad, [], "کلیدِ دسترسیِ ناشناخته در UI");
});

test("a file that calls can()/canRoute() actually pulls them from the provider", () => {
  // این دقیقاً همان اشتباهی است که یک بار رخ داد: گیت اضافه شد ولی hook جا ماند.
  // JS آن را در build نمی‌گیرد (خطای زمانِ اجراست)، پس اینجا گرفته می‌شود.
  const broken = [];

  for (const file of SOURCE_FILES) {
    const source = fs.readFileSync(file, "utf8");
    const usesGate = /\b(can|canRoute)\(/.test(
      source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
    );
    if (!usesGate) continue;
    if (rel(file).endsWith("src/components/admin/AdminPermissionProvider.jsx")) continue;

    // دو شکلِ مجاز: هوکِ کلاینت، یا در کامپوننتِ سروری همان تابعِ رجیستری
    // روی زمینه‌ی سرور (getAdminContext + canAccessAdminRoute).
    const clientForm = source.includes("useAdminPermissions()");
    const serverForm =
      source.includes("getAdminContext()") && source.includes("canAccessAdminRoute(");
    if (!clientForm && !serverForm) broken.push(rel(file));
  }

  assert.deepEqual(broken, [], "can()/canRoute() بدونِ useAdminPermissions()");
});

test("catalog create/edit/delete controls are gated on their own module keys", () => {
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

  const expected = {
    "src/app/(Admin-Panel)/p-admin/admin-sports/page.jsx": ["sports.create", "sports.reorder"],
    "src/components/templates/sports/SortableSportCard.jsx": [
      "sports.edit",
      "sports.delete",
      "sports.reorder",
    ],
    "src/app/(Admin-Panel)/p-admin/admin-sports/[sportId]/page.jsx": [
      "sports.edit",
      "categories.create",
      "categories.reorder",
    ],
    "src/app/(Admin-Panel)/p-admin/admin-sports/[sportId]/athletes/page.jsx": [
      "athletes.create",
      "athletes.edit",
      "athletes.delete",
    ],
    "src/app/(Admin-Panel)/p-admin/admin-brands/page.jsx": ["brands.create", "brands.reorder"],
    "src/components/admin/SortableBrandCard.jsx": [
      "brands.edit",
      "brands.delete",
      "brands.reorder",
    ],
    "src/components/admin/SortableCategoryCard.jsx": [
      "categories.edit",
      "categories.delete",
      "categories.reorder",
    ],
    "src/components/admin/BrandAdminPage.jsx": [
      "brands.edit",
      "brands.delete",
      "series.create",
      "series.delete",
      "limitedEditions.create",
      "limitedEditions.edit",
      "limitedEditions.delete",
    ],
    "src/components/admin/SerieAdminPage.jsx": ["series.create", "series.edit", "series.delete"],
    "src/components/admin/ProductCard.jsx": ["products.edit", "products.delete"],
    "src/components/admin/CategoryProductsClient.js": [
      "products.create",
      "categories.edit",
      "categories.delete",
    ],
    "src/app/(Admin-Panel)/p-admin/admin-products/page.jsx": ["products.create"],
    "src/app/(Admin-Panel)/p-admin/admin-products/[productId]/variants/page.jsx": [
      "variants.edit",
    ],
  };

  for (const [file, keys] of Object.entries(expected)) {
    const source = read(file);
    for (const key of keys) {
      assert.ok(
        source.includes(`"${key}"`) || source.includes(`'${key}'`),
        `${file}: گیتِ ${key} پیدا نشد`
      );
    }
  }
});

test("the shared product card is the single gate for product row actions", () => {
  const card = fs.readFileSync(
    path.join(process.cwd(), "src/components/admin/ProductCard.jsx"),
    "utf8"
  );
  assert.match(card, /const canEdit = can\('products\.edit'\)/);
  assert.match(card, /const canDelete = can\('products\.delete'\)/);
  // ردیفِ اکشن باید کاملاً حذف شود، نه غیرفعال بماند
  assert.match(card, /\{\(canEdit \|\| canDelete\) && \(/);
  assert.doesNotMatch(card, /disabled=\{!canEdit\}/);

  // و مصرف‌کننده‌ها نباید گیتِ موازیِ خودشان را داشته باشند
  for (const consumer of [
    "src/components/admin/SerieProductsClient.jsx",
    "src/components/admin/CategoryProductsClient.js",
    "src/app/(Admin-Panel)/p-admin/admin-products/page.jsx",
  ]) {
    const source = fs.readFileSync(path.join(process.cwd(), consumer), "utf8");
    assert.ok(source.includes("<ProductCard"), `${consumer}: دیگر ProductCard را رندر نمی‌کند`);
  }
});

test("drag-to-reorder is disabled without the reorder permission", () => {
  const cases = [
    ["src/app/(Admin-Panel)/p-admin/admin-sports/page.jsx", "sports.reorder"],
    ["src/app/(Admin-Panel)/p-admin/admin-sports/[sportId]/page.jsx", "categories.reorder"],
    ["src/app/(Admin-Panel)/p-admin/admin-brands/page.jsx", "brands.reorder"],
    ["src/components/admin/BrandAdminPage.jsx", "series.edit"],
    ["src/components/admin/SerieAdminPage.jsx", "series.edit"],
    ["src/components/admin/SerieProductsClient.jsx", "products.edit"],
  ];

  for (const [file, key] of cases) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    // هم دستگیره پنهان می‌شود و هم خودِ onDragEnd خنثی — دفاع در عمق
    assert.match(
      source,
      new RegExp(`onDragEnd=\\{can\\(["']${key.replace(".", "\\.")}["']\\) \\? handleDragEnd : undefined\\}`),
      `${file}: onDragEnd بدونِ گیتِ ${key}`
    );
  }
});

/* ───────────────────────────────────────────────────────────────────────────
 * فاز ۴ — بچ ۳: سفارش‌ها، مالی/تخفیف، دست دوم
 * ─────────────────────────────────────────────────────────────────────────── */

/** خواندنِ فایل با نرمال‌سازیِ CRLF — چند فایلِ پنل خطِ ویندوزی دارند. */
function readNormalized(relative) {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8").replace(/\r\n/g, "\n");
}

test("order-detail controls use the same keys as the order APIs", () => {
  const source = readNormalized("src/components/admin/orders/AdminOrderDetailClient.jsx");

  // هر کنترل با همان کلیدی گیت شده که روتِ متناظرش در manifest دارد.
  const pairs = [
    ["canChangeStatus", "orders.changeStatus", ADMIN_API_PERMISSIONS["/admin/orders/[orderId]"].PATCH],
    ["canEditItems", "orders.editItems", ADMIN_API_PERMISSIONS["/admin/orders/[orderId]/items"].PATCH],
    ["canAdjustDiscount", "orders.adjustDiscount", ADMIN_API_PERMISSIONS["/admin/orders/[orderId]/discount"].POST],
    ["canSetCurrency", "orders.setCurrency", ADMIN_API_PERMISSIONS["/admin/orders/[orderId]/eur"].PATCH],
    ["canApprove", "payments.approve", ADMIN_API_PERMISSIONS["/admin/payments/[id]/approve"].POST],
    ["canReject", "payments.reject", ADMIN_API_PERMISSIONS["/admin/payments/[id]/reject"].POST],
    ["canEditPayment", "payments.edit", ADMIN_API_PERMISSIONS["/admin/payments/[id]/edit"].PATCH],
    ["canAssign", "orderTracking.assign", ADMIN_API_PERMISSIONS["/admin/orders/[orderId]/tracking"].POST],
  ];

  for (const [flag, key, apiKey] of pairs) {
    assert.equal(apiKey, key, `manifestِ API برای ${flag} عوض شده`);
    assert.match(
      source,
      new RegExp(`const ${flag} = can\\("${key.replace(".", "\\.")}"\\)`),
      `${flag} با کلیدِ ${key} تعریف نشده`
    );
  }

  // بخشِ ویرایشِ وضعیت نباید فقط با state باز شود
  assert.match(source, /\{editStatus && canChangeStatus \? \(/);
  // ردیفِ کنترل‌های آیتم کاملاً حذف می‌شود، نه غیرفعال
  assert.match(source, /\{canEditItems && \(\n\s+<div className="flex items-center gap-2 mt-2">/);
  // دکمه‌ی ویرایشِ مبلغِ پرداخت اصلاً پاس داده نمی‌شود
  assert.match(source, /onEdit=\{canEditPayment \? \(\) => setEditPaymentTarget/);
});

test("the installment check-status route is gated on live permissions", () => {
  // این روت زیرِ /api/admin نیست و از فاز ۲ جا مانده بود.
  // این روت زیرِ /api/admin نیست، پس در جدولِ روت‌های عمومیِ ادمین‌گیت‌شده است.
  assert.equal(
    PUBLIC_ADMIN_API_PERMISSIONS["/installments/checks/[checkId]/status"].PATCH,
    "installments.edit"
  );

  const source = readNormalized("src/app/api/installments/checks/[checkId]/status/route.js");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  assert.match(code, /requireAdminPermission\("installments\.edit"\)/);
  // ادعای نقشِ داخلِ JWT دیگر ملاک نیست
  assert.doesNotMatch(code, /auth\.role !== "admin"/);
  assert.doesNotMatch(code, /verifyToken/);
  // و ردِ حسابرسی از زمینه‌ی تأییدشده می‌آید، نه از توکن
  assert.match(code, /check\.reviewedBy = ctx\.userId/);
});

test("installment check actions split edit from order approval", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/admin/financial/InstallmentChecksPanel.jsx"),
    "utf8"
  );
  assert.match(source, /const canEditChecks = can\("installments\.edit"\)/);
  assert.match(source, /const canApproveOrder = can\("installments\.approveCheck"\)/);
  assert.match(source, /\{!alreadyConfirmed && canApproveOrder && \(/);
  assert.match(source, /\{!locked && canEditChecks && \(/);

  // «تأیید سفارش» باید کلیدِ جداگانه داشته باشد — نه همان کلیدِ ویرایشِ چک
  assert.equal(
    ADMIN_API_PERMISSIONS["/admin/installments/[id]/confirm-order"].POST,
    "installments.approveCheck"
  );
});

test("discount tabs carry the module they actually belong to", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/admin/discounts/DiscountManager.jsx"),
    "utf8"
  );

  // کردیت مربیان زیرِ ماژول «مربیان» است، نه «تخفیف‌ها» — همان‌طور که API هست.
  assert.match(source, /id: "coachCredits".*view: "coaches\.view", create: "coaches\.manageCredits"/);
  assert.match(source, /id: "discounts".*view: "discounts\.view", create: "discounts\.create"/);
  assert.equal(ADMIN_API_PERMISSIONS["/admin/coach-credits"].POST, "coaches.manageCredits");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/coupons"].POST, "discounts.create");

  // آرایه قبل از رندر کوتاه می‌شود و تبِ پیش‌فرض هم از همان فهرست می‌آید
  assert.match(source, /const visibleTabs = TABS\.filter\(\(tab\) => can\(tab\.view\)\)/);
  assert.match(source, /useState\(\(\) => visibleTabs\[0\]\?\.id \|\| null\)/);
  assert.match(source, /\{visibleTabs\.map\(\(tab\) => \(/);
  assert.doesNotMatch(source, /\{TABS\.map\(\(tab\) => \(/);
  assert.match(source, /\{activeTabMeta && can\(activeTabMeta\.create\) && \(/);
});

test("every discount card gates its own row actions", () => {
  const expected = {
    "DiscountRuleCard.jsx": ["discounts.edit", "discounts.delete"],
    "QuantityDiscountCard.jsx": ["discounts.edit", "discounts.delete"],
    "CouponCard.jsx": ["discounts.edit", "discounts.delete"],
    "CoachCreditCard.jsx": ["coaches.manageCredits"],
  };

  for (const [file, keys] of Object.entries(expected)) {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/admin/discounts", file),
      "utf8"
    );
    assert.match(source, /useAdminPermissions\(\)/, `${file}: hook ندارد`);
    for (const key of keys) {
      assert.ok(source.includes(`can("${key}")`), `${file}: گیتِ ${key} ندارد`);
    }
  }
});

test("financial settings expose a save button only with the matching edit key", () => {
  const managers = {
    "BankAccountManager.jsx": "bankAccount.edit",
    "ExchangeRateManager.jsx": "exchangeRate.edit",
    "FinancingSettingsManager.jsx": "financingSettings.edit",
    "ReviewCreditSettingsManager.jsx": "reviewCredit.edit",
  };

  const valid = new Set(getAllPermissionKeys());

  for (const [file, key] of Object.entries(managers)) {
    assert.ok(valid.has(key), `کلیدِ ناشناخته: ${key}`);
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/admin/financial", file),
      "utf8"
    );
    assert.match(source, new RegExp(`const canEdit = can\\("${key.replace(".", "\\.")}"\\)`), file);
    assert.match(source, /\{canEdit \? \(/, `${file}: دکمه‌ی ذخیره گیت نشده`);
    // به‌جای دکمه‌ی ناپیدا بدون توضیح، یادداشتِ «فقط خواندنی» جایش می‌نشیند
    assert.match(source, /دسترسی ویرایش این بخش را ندارید/, `${file}: توضیحِ حالتِ فقط‌خواندنی ندارد`);
  }
});

test("the analytics export menu needs analytics.export, not analytics.view", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/admin/analytics/AnalyticsDashboard.jsx"),
    "utf8"
  );
  assert.match(source, /\{can\("analytics\.export"\) && \(\s*\n\s*<ExportMenu/);
  // صفحه با analytics.view باز می‌شود ولی خروجی گرفتن کلیدِ جداست
  assert.deepEqual(ADMIN_ROUTE_PERMISSIONS["/p-admin/financial/analytics"], ["analytics.view"]);
});

test("second-hand and health-card lists gate create, edit and delete", () => {
  const cases = {
    "src/app/(Admin-Panel)/p-admin/admin-secondHands/page.jsx": ["secondHand.create"],
    "src/app/(Admin-Panel)/p-admin/admin-secondHands/used-products/page.jsx": [
      "secondHand.create",
      "secondHand.edit",
      "secondHand.delete",
    ],
    "src/app/(Admin-Panel)/p-admin/admin-secondHands/healthcards/page.jsx": [
      "healthCards.create",
      "healthCards.edit",
      "healthCards.delete",
    ],
  };

  for (const [file, keys] of Object.entries(cases)) {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    for (const key of keys) {
      assert.ok(source.includes(`can('${key}')`), `${file}: گیتِ ${key} ندارد`);
    }
  }
});

test("order-flow cards gate edit, activate and delete", () => {
  const source = readNormalized("src/components/admin/orderFlow/OrderFlowsClient.jsx");
  assert.match(source, /can\("orderFlows\.create"\)/);
  assert.match(source, /const canEdit = can\("orderFlows\.edit"\)/);
  assert.match(source, /const canDelete = can\("orderFlows\.delete"\)/);
  // فعال/غیرفعال کردن هم PUT است، پس باید زیرِ همان orderFlows.edit باشد
  assert.equal(ADMIN_API_PERMISSIONS["/admin/order-flows/[flowId]"].PUT, "orderFlows.edit");
  assert.match(source, /\{canEdit && \(\n\s+<button\n\s+onClick=\{\(\) => onToggle\(flow\)\}/);
});

/* ───────────────────────────────────────────────────────────────────────────
 * فاز ۴ — بچ ۴: محتوا (مقالات، صفحات، صفحه‌ی اصلی، کالکشن‌ها)
 * ─────────────────────────────────────────────────────────────────────────── */

test("the article editor route requires edit, not view", () => {
  // این روت ArticleEditor را رندر می‌کند؛ با articles.view، ادمینِ فقط‌خوان
  // ویرایشگر را باز می‌کرد و تازه موقعِ ذخیره ۴۰۳ می‌گرفت.
  assert.deepEqual(ADMIN_ROUTE_PERMISSIONS["/p-admin/admin-articles/[articleId]"], ["articles.edit"]);
  // مسیرِ خواندن جداست
  assert.deepEqual(
    ADMIN_ROUTE_PERMISSIONS["/p-admin/admin-articles/[articleId]/preview"],
    ["articles.view"]
  );

  const viewer = computeEffectivePermissions({ rolePermissions: ["dashboard.view", "articles.view"] });
  assert.equal(canAccessAdminRoute(viewer, "/p-admin/admin-articles/64f000000000000000000001"), false);
  assert.equal(
    canAccessAdminRoute(viewer, "/p-admin/admin-articles/64f000000000000000000001/preview"),
    true
  );
});

test("article row actions map to the article APIs one-for-one", () => {
  const source = readNormalized("src/components/admin/articles/ArticleList.jsx");

  assert.match(source, /const canCreate = can\("articles\.create"\)/);
  assert.match(source, /const canEdit = can\("articles\.edit"\)/);
  assert.match(source, /const canDelete = can\("articles\.delete"\)/);

  // کپی = POST duplicate → articles.create
  assert.equal(ADMIN_API_PERMISSIONS["/admin/article-cms/[id]/duplicate"].POST, "articles.create");
  assert.match(source, /\{canCreate \? <button onClick=\{\(\) => duplicate\(article\._id\)\}/);

  // بازیابی = POST restore → articles.edit
  assert.equal(ADMIN_API_PERMISSIONS["/admin/article-cms/[id]/restore"].POST, "articles.edit");
  assert.match(source, /view === "trash" \? <>\{canEdit \?/);

  // حذفِ دائمی از زباله‌دان = همان DELETE مقاله با ?permanent=true → articles.delete
  // (کلیدِ جدیدی جعل نشده؛ همان کلیدی است که انتقال به زباله‌دان با آن گیت شده.)
  assert.match(source, /\{canDelete \? <button onClick=\{\(\) => destroy\(article\._id, article\.title\)\}/);
  assert.match(source, /\/api\/admin\/articles\/\$\{id\}\?permanent=true/);

  // آرشیو = PATCH مقاله → articles.edit ؛ زباله‌دان = DELETE → articles.delete
  // فاز ۵: PATCH شاخه‌ای شد — ویرایش articles.edit، ولی انتشار articles.publish
  // هم می‌خواهد. بدنه‌ی بدونِ status همان رفتارِ قبلی را دارد.
  assert.deepEqual(ADMIN_API_PERMISSIONS["/admin/articles/[id]"].PATCH, {
    branch: "resolveArticlePatchPermissions",
  });
  assert.deepEqual(resolveArticlePatchPermissions({ title: "x" }).permissions, ["articles.edit"]);
  assert.equal(ADMIN_API_PERMISSIONS["/admin/articles/[id]"].DELETE, "articles.delete");
  assert.match(source, /\{article\.status !== "archived" && canEdit \?/);
  assert.match(source, /\{canDelete \? <button onClick=\{\(\) => trash\(article\._id, article\.title\)\}/);
});

test("article taxonomy has one key for both create and archive", () => {
  // ماژول فقط view/manage دارد — کلیدِ create/delete جعل نشده است.
  const taxonomy = PERMISSION_MODULES.find((m) => m.key === "articleTaxonomy");
  assert.deepEqual(
    taxonomy.permissions.map((p) => p.fullKey).sort(),
    ["articleTaxonomy.manage", "articleTaxonomy.view"]
  );
  assert.equal(ADMIN_API_PERMISSIONS["/admin/article-categories"].POST, "articleTaxonomy.manage");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/article-tags/[id]"].DELETE, "articleTaxonomy.manage");

  const source = readNormalized("src/components/admin/articles/ArticleTaxonomies.jsx");
  assert.match(source, /const canManage = can\("articleTaxonomy\.manage"\)/);
  assert.match(source, /\{canManage \? <div className="p-4 border-b space-y-3"/);
  assert.match(source, /\{item\.status !== "archived" && canManage \?/);
  // حذفِ دائمی هم زیرِ همان manage است و فقط برای دسته‌بندیِ آرشیوشده دیده می‌شود.
  assert.match(source, /\{isCategory && item\.status === "archived" && canManage \?/);
  assert.equal(ADMIN_API_PERMISSIONS["/admin/article-categories/[id]"].DELETE, "articleTaxonomy.manage");
});

test("home section managers gate on the site-setting owner key", () => {
  // این چهار مدیر همگی روی /api/admin/site-settings می‌نویسند و کلیدشان از
  // SITE_SETTING_OWNERS می‌آید، نه از یک نگاشتِ محلی.
  assert.equal(SITE_SETTING_OWNERS.home_featured_article_ids.edit, "homeFeaturedArticles.edit");

  const featured = readNormalized("src/components/admin/home/FeaturedArticlesManager.jsx");
  assert.match(featured, /const canEdit = can\("homeFeaturedArticles\.edit"\)/);
  assert.match(featured, /دسترسی ویرایش این بخش را ندارید/);

  const roland = readNormalized("src/components/admin/home/RolandGarrosBannerManager.jsx");
  assert.match(roland, /const canEdit = can\("homeRolandGarros\.edit"\)/);
  assert.equal(ADMIN_API_PERMISSIONS["/admin/home-roland-garros"].PUT, "homeRolandGarros.edit");

  const sliders = readNormalized("src/components/admin/home/ProductSliderManager.jsx");
  assert.match(sliders, /const canEdit = can\("homeProductSliders\.edit"\)/);
  assert.equal(ADMIN_API_PERMISSIONS["/admin/home-sliders"].PUT, "homeProductSliders.edit");
  // جعبه‌ی جست‌وجو تنها راهِ افزودن است، پس خودش هم گیت می‌شود
  assert.match(sliders, /\{canEdit && \(\n\s+<div className="relative" ref=\{wrapRef\}>/);
  assert.match(sliders, /onDragEnd=\{canEdit \? onDragEnd : \(\) => \{\}\}/);
});

test("home banners and slides gate every mutation on their edit key", () => {
  const banners = readNormalized("src/app/(Admin-Panel)/p-admin/admin-home/banners/page.jsx");
  assert.match(banners, /const canEdit = can\('homeBanners\.edit'\)/);
  assert.equal(PUBLIC_ADMIN_API_PERMISSIONS["/banners"].POST, "homeBanners.edit");
  assert.equal(PUBLIC_ADMIN_API_PERMISSIONS["/banners/[id]"].DELETE, "homeBanners.edit");

  const slider = readNormalized("src/app/(Admin-Panel)/p-admin/admin-home/slider/page.jsx");
  assert.match(slider, /const canEdit = can\('homeSlider\.edit'\)/);
  assert.equal(PUBLIC_ADMIN_API_PERMISSIONS["/slides/reorder"].POST, "homeSlider.edit");
  // ترتیب هم باید خنثی شود، نه فقط دستگیره پنهان
  assert.match(slider, /onDragEnd=\{canEdit \? onDragEnd : \(\) => \{\}\}/);
});

test("collection status changes use publish, not edit", () => {
  // بایگانی/توقف/فعال‌سازی همگی PUT روی /events/[id]/status اند.
  assert.equal(ADMIN_API_PERMISSIONS["/admin/events/[id]/status"].PUT, "collections.publish");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/events/[id]/duplicate"].POST, "collections.create");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/events/[id]"].DELETE, "collections.delete");

  const source = readNormalized("src/components/admin/events/EventList.jsx");
  assert.match(source, /const canPublish = can\("collections\.publish"\)/);
  assert.match(source, /\{!canPublish \? null : event\.status === "active" \? \(/);
  assert.match(source, /\{event\.status !== "archived" && canPublish && \(/);
  assert.match(source, /const canCreate = can\("collections\.create"\)/);
  assert.match(source, /const canDelete = can\("collections\.delete"\)/);
});

test("a server component reads permissions from the server context, not a hook", () => {
  // ArticlePreview کامپوننتِ سروری است؛ useAdminPermissions آنجا کار نمی‌کند.
  // کامنت‌ها کنار می‌روند: خودِ توضیحِ «اینجا هوک کار نمی‌کند» وگرنه match می‌شود.
  const source = readNormalized("src/components/admin/articles/ArticlePreview.jsx");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /useAdminPermissions/);
  assert.match(source, /const ctx = await getAdminContext\(\)/);
  assert.match(source, /canAccessAdminRoute\(ctx\?\.permissions \|\| \[\], route\)/);
});

test("editors gate only what their route guard does not already cover", () => {
  // ذخیره‌ی خودِ محتوا همان کلیدی را می‌خواهد که روتِ صفحه لازم دارد، پس
  // گیتِ دومی برایش لازم نیست. تنها استثنا «انتشار» است که از فاز ۵ کلیدِ
  // مستقل دارد و باید *داخلِ* ویرایشگر گیت شود.
  assert.deepEqual(ADMIN_ROUTE_PERMISSIONS["/p-admin/admin-articles/new"], ["articles.create"]);
  assert.deepEqual(ADMIN_ROUTE_PERMISSIONS["/p-admin/admin-pages/[slug]"], ["pages.edit"]);
  assert.deepEqual(ADMIN_ROUTE_PERMISSIONS["/p-admin/admin-events/campaigns/new"], ["collections.create"]);
  assert.deepEqual(ADMIN_ROUTE_PERMISSIONS["/p-admin/admin-events/campaigns/[id]"], ["collections.edit"]);

  // EventForm هیچ عملیاتِ جدا از روتش ندارد → بدونِ گیت، عمدی.
  assert.doesNotMatch(
    readNormalized("src/components/admin/events/EventForm.jsx"),
    /useAdminPermissions/,
    "EventForm: گیتِ دومِ غیرلازم اضافه شده"
  );

  // این دو دقیقاً و فقط کلیدِ انتشار را گیت می‌کنند.
  for (const [file, key] of [
    ["src/components/admin/articles/ArticleEditor.jsx", "articles.publish"],
    ["src/components/admin/pages/PageEditor.jsx", "pages.publish"],
  ]) {
    const source = readNormalized(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    const gates = [...source.matchAll(/\bcan\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
    assert.deepEqual(gates, [key], `${file}: مجموعه‌ی گیت‌ها باید دقیقاً [${key}] باشد`);
  }
});

test("publishing is a separate key from editing", () => {
  // مقاله: بدونِ status فقط ویرایش؛ با وضعیتِ منتشرکننده، انتشار هم لازم است.
  assert.deepEqual(resolveArticlePatchPermissions({ title: "x" }).permissions, ["articles.edit"]);
  assert.deepEqual(resolveArticlePatchPermissions({ status: "draft" }).permissions, ["articles.edit"]);
  assert.deepEqual(resolveArticlePatchPermissions({ status: "archived" }).permissions, ["articles.edit"]);
  assert.deepEqual(resolveArticlePatchPermissions({ status: "published" }).permissions, [
    "articles.edit",
    "articles.publish",
  ]);
  assert.deepEqual(resolveArticlePatchPermissions({ status: "scheduled" }).permissions, [
    "articles.edit",
    "articles.publish",
  ]);
  // مقدارِ ناشناخته سمتِ سخت‌گیرانه می‌افتد
  assert.deepEqual(resolveArticlePatchPermissions({ status: "zzz" }).permissions, [
    "articles.edit",
    "articles.publish",
  ]);
  assert.equal(resolveArticlePatchPermissions({}).allowed, false);
  assert.equal(resolveArticlePatchPermissions(null).allowed, false);

  // صفحه: فقط تغییرِ *صریحِ* وضعیتِ انتشار کلیدِ publish می‌خواهد؛ ذخیره‌ی
  // محتوای یک صفحه‌ی منتشرشده نباید ویراستار را قفل کند.
  assert.deepEqual(resolvePagePutPermissions({ slug: "x", sections: [] }).permissions, ["pages.edit"]);
  assert.deepEqual(resolvePagePutPermissions({ published: true }).permissions, [
    "pages.edit",
    "pages.publish",
  ]);
  assert.deepEqual(resolvePagePutPermissions({ published: false }).permissions, [
    "pages.edit",
    "pages.publish",
  ]);
  assert.equal(resolvePagePutPermissions(null).allowed, false);

  // ویرایشگرِ مقاله هم وقتی اجازه‌ی انتشار ندارد، status را اصلاً نمی‌فرستد،
  // وگرنه ویرایشِ یک مقاله‌ی از قبل منتشرشده ۴۰۳ می‌گرفت.
  const editor = readNormalized("src/components/admin/articles/ArticleEditor.jsx");
  assert.ok(
    editor.includes('const NON_PUBLISHING_STATUSES = ["draft", "review", "archived"]'),
    "فهرستِ وضعیت‌های غیرمنتشرکننده در ویرایشگر نیست"
  );
  assert.ok(
    editor.includes("if (!canPublish && !NON_PUBLISHING_STATUSES.includes(payload.status)) {"),
    "payload بدونِ کلیدِ انتشار، status را حذف نمی‌کند"
  );
  assert.match(editor, /delete payload.status/);

  // و هندلر وقتی فیلد نیامده، مقدارِ فعلی را دست نمی‌زند (کامنت‌ها کنار می‌روند)
  const route = readNormalized("src/app/api/admin/pages/route.js").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    ""
  );
  assert.match(route, /if \(typeof body\.published === "boolean"\) update\.published = body\.published/);
  assert.doesNotMatch(route, /published: body\.published !== false/);
});

// بررسیِ «کلیدهای یتیم» به ماتریسِ پوششِ فاز ۵ منتقل شد
// (scripts/rbacCoverage.mjs). آن نسخه دقیق‌تر است: resolverهای شاخه‌ای را باز
// می‌کند و کلیدی را که پیش‌نیازِ کلیدِ دیگری است «بی‌استفاده» نمی‌شمارد.
// تستِ جایگزین در بخشِ فاز ۵ همین فایل است.

/* ───────────────────────────────────────────────────────────────────────────
 * فاز ۴ — بچ ۵ (پایانی): افراد و پشتیبانی
 * ─────────────────────────────────────────────────────────────────────────── */

test("the users list no longer offers promote-to-admin", () => {
  // فاز ۳ این مسیر را بست و سرور همیشه ردش می‌کند؛ دکمه‌ها از آن زمان مرده بودند.
  // کامنت‌ها کنار می‌روند: توضیحِ «این دکمه حذف شد» خودش شامل همان عبارت است.
  const source = readNormalized("src/app/(Admin-Panel)/p-admin/users/page.jsx").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    ""
  );

  assert.doesNotMatch(source, /handleChangeRole/, "هندلرِ ارتقا به مدیر هنوز هست");
  assert.doesNotMatch(source, /ارتقا به مدیر/, "برچسبِ «ارتقا به مدیر» هنوز رندر می‌شود");
  assert.doesNotMatch(source, /nextRole/, "منطقِ جابه‌جاییِ نقشِ admin هنوز هست");

  // و لایه‌ی سرور همچنان همان قاعده را دارد
  assert.equal(resolveUserPatchPermissions({ role: "admin" }).allowed, false);
  assert.equal(resolveUserPatchPermissions({ role: "admin" }).reason, "admin-role-not-assignable-here");
});

test("the users list gates banning and its cross-module shortcuts", () => {
  const source = readNormalized("src/app/(Admin-Panel)/p-admin/users/page.jsx");

  assert.match(source, /const canBan = can\('users\.ban'\)/);
  assert.equal(resolveUserPatchPermissions({ isBanned: true }).permissions[0], "users.ban");

  // میان‌برها به سه ماژولِ دیگر می‌روند، پس با روتِ مقصد سنجیده می‌شوند
  for (const route of [
    "/p-admin/users/notifications",
    "/p-admin/users/admins",
    "/p-admin/users/coaches",
  ]) {
    assert.ok(source.includes(`canRoute('${route}')`), `میان‌برِ ${route} گیت ندارد`);
  }
});

test("the user detail page sends only changed fields the admin may change", () => {
  const source = readNormalized("src/app/(Admin-Panel)/p-admin/users/[userId]/page.jsx");

  // نگاشتِ فیلد→کلید باید دقیقاً همان چیزی باشد که resolver اعمال می‌کند
  for (const [field, key] of [
    ["name", "users.edit"],
    ["level", "users.edit"],
    ["role", "users.changeRole"],
    ["walletBalance", "users.adjustWallet"],
    ["isBanned", "users.ban"],
  ]) {
    assert.ok(
      source.includes(`${field}: '${key}'`),
      `FIELD_PERMISSION: ${field} → ${key} پیدا نشد`
    );
    assert.deepEqual(resolveUserPatchPermissions({ [field]: field === "isBanned" ? true : "x" }).permissions, [key]);
  }

  // payload از تفاوتِ فرم با کاربرِ فعلی ساخته می‌شود، نه از کلِ فرم
  assert.match(source, /const buildPayload = \(\) => \{/);
  assert.match(source, /if \(!can\(permission\)\) continue/);
  assert.doesNotMatch(source, /body: JSON\.stringify\(form\)/);
  assert.match(source, /body: JSON\.stringify\(payload\)/);

  // و هر ورودی جدا گیت می‌شود
  assert.match(source, /\{editing && canEditProfile \? \(/);
  assert.match(source, /\{editing && canChangeRole \? \(/);
  assert.match(source, /\{editing && canAdjustWallet \? \(/);
  assert.match(source, /\{editing && canBan \? \(/);
  assert.match(source, /canEditAnything && \(/);
});

test("activating and revoking an admin are different keys in the UI too", () => {
  // resolveAdminPatchPermissions جهت را می‌بیند: true→activate، false→revoke.
  assert.deepEqual(resolveAdminPatchPermissions({ isActive: true }).permissions, ["admins.activate"]);
  assert.deepEqual(resolveAdminPatchPermissions({ isActive: false }).permissions, ["admins.revoke"]);

  const list = readNormalized("src/app/(Admin-Panel)/p-admin/users/admins/page.jsx");
  assert.match(
    list,
    /\{\(admin\.isActive \? can\('admins\.revoke'\) : can\('admins\.activate'\)\) && \(/,
    "کلیدِ ثابت به‌جای کلیدِ وابسته به جهت"
  );
  assert.match(list, /\{can\('admins\.create'\) && \(/);
  assert.match(list, /\{can\('roles\.view'\) && \(/);
  assert.match(list, /\{can\('admins\.revoke'\) && \(/); // حذفِ عضویت
});

test("the admin form only sends fields the editor is allowed to change", () => {
  const source = readNormalized("src/components/admin/admins/AdminForm.jsx");

  assert.match(source, /const canManagePermissions = can\('admins\.managePermissions'\)/);
  assert.match(source, /const canEditFields = can\('admins\.edit'\)/);
  assert.match(source, /const canToggleActive = \(next\) => can\(next \? 'admins\.activate' : 'admins\.revoke'\)/);

  // ساخت: یک payload کامل زیرِ admins.create
  assert.match(source, /userId: linkedUser\._id/);
  // ویرایش: فقط فیلدهای مجاز، و isActive فقط وقتی واقعاً عوض شده
  assert.match(source, /if \(canManagePermissions\) payload\.permissions = formData\.permissions/);
  assert.match(source, /formData\.isActive !== initial\.current\.isActive && canToggleActive\(formData\.isActive\)/);

  // و همان کلیدها در سمت سرور
  assert.deepEqual(resolveAdminPatchPermissions({ title: "x" }).permissions, ["admins.edit"]);
  assert.deepEqual(resolveAdminPatchPermissions({ permissions: [] }).permissions, ["admins.managePermissions"]);
});

test("roles are gated on the roles module, not on admins", () => {
  assert.equal(ADMIN_API_PERMISSIONS["/admin/roles"].POST, "roles.create");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/roles/[id]"].PUT, "roles.edit");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/roles/[id]"].DELETE, "roles.delete");

  const source = readNormalized("src/components/admin/admins/RolesManager.jsx");
  assert.match(source, /const canCreateRole = can\('roles\.create'\)/);
  assert.match(source, /const canEditRole = can\('roles\.edit'\)/);
  assert.match(source, /const canDeleteRole = can\('roles\.delete'\)/);
  // دکمه‌ی ذخیره‌ی فرم بسته به ساخت/ویرایش کلیدِ متفاوتی می‌خواهد
  assert.match(source, /\{\(editingRole\._id \? canEditRole : canCreateRole\) && \(/);
});

test("support actions split view from reply, close, moderate and delete", () => {
  const chat = readNormalized("src/components/admin/support/AdminTicketChat.jsx");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/tickets/[id]/messages"].POST, "tickets.reply");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/tickets/[id]"].PATCH, "tickets.close");
  assert.match(chat, /const canReply = can\("tickets\.reply"\)/);
  assert.match(chat, /const canClose = can\("tickets\.close"\)/);
  assert.match(chat, /\{!canClose \? null : isClosed \? \(/);
  // به‌جای کامپوزرِ ناپیدا، توضیح داده می‌شود
  assert.match(chat, /دسترسی پاسخ به تیکت را ندارید/);

  const comments = readNormalized("src/components/admin/comments/CommentsModeration.jsx");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/comments/[id]"].PATCH, "comments.moderate");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/comments/[id]"].DELETE, "comments.delete");
  assert.match(comments, /const canModerate = can\("comments\.moderate"\)/);
  assert.match(comments, /const canDelete = can\("comments\.delete"\)/);

  const inbox = readNormalized("src/components/admin/support/ContactMessagesInbox.jsx");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/contact-messages/[id]"].DELETE, "contactMessages.manage");
  assert.match(inbox, /const canManage = can\("contactMessages\.manage"\)/);
});

test("coach review and credit links use their own keys", () => {
  assert.equal(ADMIN_API_PERMISSIONS["/admin/coach-applications/[id]/review"].PUT, "coaches.manage");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/coaches/[coachId]/wallet"].POST, "coaches.manageCredits");

  const list = readNormalized("src/app/(Admin-Panel)/p-admin/users/coaches/page.jsx");
  assert.match(list, /const canReview = can\("coaches\.manage"\)/);
  assert.match(list, /\{canReview && \(/);

  // ردیفِ سفارش در صفحه‌ی مربی به صفحه‌ی کردیت می‌رود؛ بدون دسترسی، لینک نمی‌شود
  const detail = readNormalized("src/app/(Admin-Panel)/p-admin/users/coaches/[coachId]/page.jsx");
  assert.match(detail, /const Row = canRoute\(creditHref\) \? Link : "div"/);
  assert.deepEqual(
    ADMIN_ROUTE_PERMISSIONS["/p-admin/users/coaches/[coachId]/credit/[orderId]"],
    ["coaches.manageCredits"]
  );
});

test("sending a user broadcast needs send, not view", () => {
  assert.equal(ADMIN_API_PERMISSIONS["/admin/user-notifications"].GET, "userNotifications.view");
  assert.equal(ADMIN_API_PERMISSIONS["/admin/user-notifications"].POST, "userNotifications.send");
  assert.deepEqual(
    ADMIN_ROUTE_PERMISSIONS["/p-admin/users/notifications"],
    ["userNotifications.view"]
  );

  const source = readNormalized("src/app/(Admin-Panel)/p-admin/users/notifications/page.jsx");
  assert.match(source, /const canSend = can\('userNotifications\.send'\)/);
  assert.match(source, /\{canSend \? \(/);
  assert.match(source, /دسترسی ارسال اعلان را ندارید/);
});

test("Phase 4 is complete: every admin module group has UI gates", () => {
  // یک بررسیِ فراگیر: هیچ ماژولی نباید بدونِ استفاده‌ی UI بماند وقتی
  // اکشنِ نوشتنی دارد. کلیدهای نوشتنی = هر کلیدی جز *.view.
  const uiKeys = new Set();
  for (const file of SOURCE_FILES) {
    const source = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    for (const m of source.matchAll(/\bcan\(\s*(\[[^\]]*\]|["'][^"']+["'])/g)) {
      for (const quoted of m[1].match(/["']([^"']+)["']/g) || []) {
        uiKeys.add(quoted.slice(1, -1));
      }
    }
  }

  // ماژول‌هایی که فقط از طریق گاردِ روت محافظت می‌شوند و اکشنِ درون‌صفحه‌ای
  // ندارند — عمداً بدونِ can() در UI. هر کدام دلیلِ مشخص دارد.
  const ROUTE_GUARDED_ONLY = new Set([
    "dashboard", // فقط view
    "home", // ری‌دایرکت به تبِ صفحات
    "navbar", // اکشنِ سروری/کش، بدون UI
    "payments", // اکشن‌هایش در صفحه‌ی سفارش گیت شده‌اند (کلیدها استفاده شده)
    // صفحات CMS: مجموعه‌ی ثابتی از اسلاگ‌هاست. تنها اکشن، «ویرایش» است که
    // خودش یک روتِ مستقل (/p-admin/admin-pages/[slug] → pages.edit) دارد و
    // لینکش با canRoute گیت شده؛ create/publish/delete اصلاً وجود ندارند
    // (در فهرستِ کلیدهای یتیمِ فاز ۵ ثبت شده‌اند).
    "pages",
  ]);

  const missing = [];
  for (const mod of PERMISSION_MODULES) {
    if (ROUTE_GUARDED_ONLY.has(mod.key)) continue;
    const writeKeys = mod.permissions
      .map((p) => p.fullKey)
      .filter((k) => !k.endsWith(".view"));
    if (!writeKeys.length) continue;
    if (!writeKeys.some((k) => uiKeys.has(k))) missing.push(mod.key);
  }

  // پس از بچ ۵ هیچ ماژولِ نوشتنی‌ای نباید بدونِ گیتِ UI بماند.
  assert.deepEqual(missing, [], `ماژول‌های بدونِ گیتِ UI: ${missing.join(", ")}`);
});

/* ───────────────────────────────────────────────────────────────────────────
 * فاز ۵ — آشتیِ رجیستری و ماتریسِ پوشش
 * ─────────────────────────────────────────────────────────────────────────── */

const { matrix: COVERAGE, findings: COVERAGE_FINDINGS } = buildCoverage();

test("the coverage matrix reports no blocking finding", () => {
  const blocking = COVERAGE_FINDINGS.filter((f) => f.blocking).map(
    (f) => `${f.code} · ${f.subject} — ${f.detail}`
  );
  // هر یافته یا باید رفع شود یا با دلیل در ACCEPTED ثبت شود؛ سکوت گزینه نیست.
  assert.deepEqual(blocking, []);
});

test("the accepted-exception list stays small and justified", () => {
  // اگر این فهرست بی‌سروصدا بزرگ شود، «سبز بودنِ» ماتریس بی‌معنا می‌شود.
  assert.deepEqual(Object.keys(ACCEPTED.UNGATED_PAGES), ["/p-admin/403"]);
  assert.deepEqual(Object.keys(ACCEPTED.UI_ONLY_KEYS), ["analytics.export"]);
  // فاز ۶ آخرین کلیدِ «برنامه‌ریزی‌شده» را وصل کرد؛ این فهرست باید خالی بماند.
  assert.deepEqual(Object.keys(ACCEPTED.PLANNED_KEYS), []);
  assert.deepEqual(Object.keys(ACCEPTED.VIEW_KEYS_WITH_WRITES), ["collections.view"]);
  assert.deepEqual(Object.keys(ACCEPTED.ROUTE_GUARDED_MODULES).sort(), [
    "dashboard",
    "home",
    "navbar",
    "pages",
  ]);

  // و هر استثنا باید دلیلِ نوشته‌شده داشته باشد، نه رشته‌ی خالی
  for (const group of Object.values(ACCEPTED)) {
    for (const [subject, reason] of Object.entries(group)) {
      assert.ok(reason && reason.length > 20, `${subject}: دلیلِ استثنا خیلی کوتاه است`);
    }
  }
});

test("the matrix links every enforced key to a module and a section", () => {
  // کلیدی که به ماژول/بخش وصل نباشد در UIِ انتخابِ دسترسی هم دیده نمی‌شود.
  const orphanMeta = COVERAGE.filter((row) => !row.module || !row.section).map((r) => r.key);
  assert.deepEqual(orphanMeta, []);

  // و هر کلید عنوانِ فارسیِ خودش را دارد
  const untitled = COVERAGE.filter((row) => !row.title).map((r) => r.key);
  assert.deepEqual(untitled, []);
});

test("retired keys are gone from the registry and from the code", () => {
  const all = new Set(getAllPermissionKeys());
  for (const key of ["orders.edit", "pages.create", "pages.delete"]) {
    assert.ok(!all.has(key), `${key} هنوز در رجیستری است`);
  }

  // orders.edit «مبهم» است نه «بازنشسته»: نباید خودکار به چهار کلید تبدیل شود.
  assert.ok(!RETIRED_PERMISSIONS["orders.edit"], "orders.edit نباید در RETIRED باشد");
  assert.deepEqual(AMBIGUOUS_PERMISSIONS["orders.edit"].candidates, [
    "orders.changeStatus",
    "orders.editItems",
    "orders.adjustDiscount",
    "orders.setCurrency",
  ]);
  const classified = classifyPermissionKeys(["orders.edit"]);
  assert.equal(classified.ambiguous.length, 1);
  assert.equal(classified.valid.length, 0);
  // مهاجرت نباید خودش تصمیم بگیرد
  assert.deepEqual(migratePermissionKeys(["orders.edit"]).permissions, []);

  // pages.create/delete حذفِ قطعی‌اند
  for (const key of ["pages.create", "pages.delete"]) {
    assert.equal(RETIRED_PERMISSIONS[key].action, "drop");
    assert.deepEqual(RETIRED_PERMISSIONS[key].replacement, []);
    assert.ok(RETIRED_PERMISSIONS[key].reason.length > 20);
  }
});

test("the limited-edition read endpoints are no longer public", () => {
  // پیش از فاز ۵ هر دو GET بدونِ هیچ گیتی بودند، در حالی که تنها
  // مصرف‌کننده‌هایشان صفحه‌های پنل‌اند (ویترین از سرویس‌ها می‌خواند).
  assert.equal(PUBLIC_ADMIN_API_PERMISSIONS["/limited-editions"].GET, "limitedEditions.view");
  assert.equal(PUBLIC_ADMIN_API_PERMISSIONS["/limited-editions/[id]"].GET, "limitedEditions.view");

  for (const file of [
    "src/app/api/limited-editions/route.js",
    "src/app/api/limited-editions/[id]/route.js",
  ]) {
    const source = readNormalized(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.match(source, /requireAdminPermission\("limitedEditions\.view"\)/, file);
  }
});

test("the coverage script is runnable and fails loudly on blocking findings", () => {
  const result = spawnSync(process.execPath, ["scripts/rbacCoverage.mjs", "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.ok(Array.isArray(payload.matrix) && payload.matrix.length > 100);
  assert.deepEqual(payload.findings.filter((f) => f.blocking), []);

  // package.json باید راهِ اجرای آن را داشته باشد
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
  assert.equal(pkg.scripts["rbac:coverage"], "node scripts/rbacCoverage.mjs");
});

test("permission labels are distinct, Persian and free of leftover placeholders", () => {
  const problems = [];

  for (const mod of PERMISSION_MODULES) {
    if (!mod.title || !mod.description) problems.push(`${mod.key}: عنوان یا توضیح ندارد`);

    const titles = new Set();
    for (const perm of mod.permissions) {
      const title = perm.title || "";
      if (!title) problems.push(`${perm.fullKey}: عنوان ندارد`);
      // برچسبِ لاتین یا TODO در رابطِ فارسی جایی ندارد
      if (/^[\x00-\x7F]+$/.test(title)) problems.push(`${perm.fullKey}: عنوانِ غیرفارسی «${title}»`);
      if (/TODO|FIXME|\?\?\?/i.test(title)) problems.push(`${perm.fullKey}: عنوانِ ناتمام`);
      if (titles.has(title)) problems.push(`${mod.key}: عنوانِ تکراری «${title}»`);
      titles.add(title);
    }
  }

  assert.deepEqual(problems, []);
});

test("sections mirror the real panel, and every module belongs to one", () => {
  const sectionOfModule = new Map();
  for (const section of PERMISSION_SECTIONS) {
    for (const mod of section.modules) {
      assert.ok(!sectionOfModule.has(mod.key), `${mod.key} در دو بخش تکرار شده`);
      sectionOfModule.set(mod.key, section.key);
    }
  }
  for (const mod of PERMISSION_MODULES) {
    assert.ok(sectionOfModule.has(mod.key), `${mod.key} به هیچ بخشی تعلق ندارد`);
  }

  // مسیرِ هر بخش باید یا روتِ واقعیِ پنل باشد یا صریحاً null (بخشِ بدون صفحه)
  for (const section of PERMISSION_SECTIONS) {
    if (section.path === null) continue;
    assert.ok(
      ADMIN_ROUTE_PERMISSIONS[section.path],
      `بخشِ ${section.key}: مسیرِ ${section.path} روتِ شناخته‌شده نیست`
    );
  }
});

/* ───────────────────────────────────────────────────────────────────────────
 * فاز ۶ — دفترِ فعالیتِ ادمین
 * ─────────────────────────────────────────────────────────────────────────── */

test("authorization denials are recorded by the gate itself, not per route", () => {
  // اگر ثبت به هندلرها سپرده شود، هر روتِ جدیدی که یادش برود از ممیزی جا
  // می‌ماند. تنها نقطه‌ای که همه‌ی ردها از آن می‌گذرند همین گیت است.
  const gate = readNormalized("src/lib/requireAdminPermission.js");

  assert.match(gate, /import \{\s*recordAdminActivity,\s*recordAuthorizationDenial,\s*\} from "@\/lib\/adminActivity"/s);
  // ردها باید await شوند: بدونِ آن، هندلر پاسخ می‌دهد و promiseِ معلق پیش از
  // رسیدن به دیتابیس قطع می‌شود — در اجرای واقعی هیچ ردی نوشته نمی‌شد.
  assert.match(gate, /if \(decision\.status !== 200\) \{\s*await recordAuthorizationDenial\(/s);

  // و اقدامِ نوشتنی هم خودکار ممیزی می‌شود — ولی از فاز ۹ رکوردش در *پایانِ*
  // درخواست ساخته می‌شود، چون فقط آنجا معلوم است چه چیزی واقعاً عوض شد.
  assert.match(gate, /const writes = keys\.filter\(\(key\) => !isReadKey\(key\)\)/);
  assert.match(gate, /activateAuditScope\(scope, \{ ctx, permissions: writes \}\)/);
  assert.match(gate, /scheduleAuditFlush\(scope\)/);

  // ⚠️ دامنه باید *پیش از اولین await* باز شود، وگرنه enterWith روی فریمِ
  // خودِ گیت می‌نشیند و هندلر هیچ‌وقت آن را نمی‌بیند (روی Node 24 تجربی
  // بررسی شد). این تست همان ترتیب را قفل می‌کند.
  // کامنت‌ها حذف می‌شوند: خودِ توضیحِ بالای تابع کلمه‌ی «await» را دارد و
  // بدونِ این کار، تست به متنِ خودش گیر می‌کرد نه به کد.
  const gateCode = gate.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const openIndex = gateCode.indexOf("const scope = openAuditScope();");
  const firstAwait = gateCode.indexOf("await ", gateCode.indexOf("export default async function"));
  assert.ok(openIndex > -1, "گیت دیگر دامنه‌ی ممیزی باز نمی‌کند");
  assert.ok(
    openIndex < firstAwait,
    "openAuditScope باید پیش از اولین await باشد وگرنه دامنه به هندلر نمی‌رسد"
  );

  // رکوردِ «مجاز شد» همچنان وجود دارد — فقط جایش عوض شده — پس معنیِ
  // رکوردهای قدیمی دست‌نخورده می‌ماند.
  const flush = readNormalized("src/lib/adminAuditFlush.js");
  assert.match(flush, /action: "authz\.granted"/);
  assert.match(flush, /result: "attempted"/);
  // و رکوردِ تفصیلی فقط وقتی نوشته می‌شود که نوشتنی واقعاً رخ داده باشد
  assert.match(flush, /if \(scope\.handled\) return false;/);

  // `admins.viewActivity` پسوندِ .view ندارد ولی خواندنی است — بدونِ این
  // استثنا، هر بار باز کردنِ خودِ دفتر یک رکوردِ «اقدامِ نوشتنی» می‌ساخت.
  assert.match(gate, /const NON_SUFFIX_READ_KEYS = new Set\(\["admins\.viewActivity", "analytics\.export"\]\)/);
  // (خودِ ماژول با alias نوشته شده و از تستِ node قابل ایمپورت نیست؛ همان
  //  تصمیم روی سورس بررسی می‌شود.)
  assert.ok(
    gate.includes(
      'export const AUDITED_READ_KEYS = new Set(["admins.viewActivity", "analytics.export"]);'
    ),
    "تصمیمِ «کدام خواندن‌ها ممیزی می‌شوند» عوض شده"
  );
  assert.match(gate, /action: "authz\.read"/);
  // خاموش‌کردن فقط ثبتِ عمومی را می‌گیرد، نه ثبتِ ردها
  assert.match(gate, /if \(options\?\.audit !== false\) \{/);
});

test("the ledger never stores a secret, whatever the field is called", () => {
  for (const name of [
    "password",
    "Password",
    "new_password",
    "accessToken",
    "access-token",
    "refreshToken",
    "otp",
    "apiKey",
    "cardNumber",
    "iban",
  ]) {
    assert.equal(isSecretField(name), true, `${name} باید راز شناخته شود`);
  }
  for (const name of ["title", "status", "amount", "isActive", "role"]) {
    assert.equal(isSecretField(name), false, `${name} نباید راز شناخته شود`);
  }

  const cleaned = redact({
    password: "hunter2",
    nested: { refresh_token: "x", ok: 1 },
    certificateImage: "https://private/a.pdf",
    list: ["a", "b"],
  });
  assert.equal(cleaned.password, REDACTED);
  assert.equal(cleaned.nested.refresh_token, REDACTED);
  assert.equal(cleaned.nested.ok, 1);
  assert.equal(cleaned.certificateImage, "[سندِ خصوصی]");
  assert.deepEqual(cleaned.list, ["a", "b"]);
});

test("redaction bounds size so one request cannot flood the ledger", () => {
  const long = redact({ note: "x".repeat(2000) });
  assert.ok(long.note.length < 600, "رشته‌ی بلند کوتاه نشده");
  assert.ok(long.note.endsWith("…"));

  const many = redact({ items: Array.from({ length: 200 }, (_, i) => i) });
  assert.ok(many.items.length <= 51, "آرایه‌ی بلند مهار نشده");
  assert.match(String(many.items.at(-1)), /مورد دیگر/);

  const deep = redact({ a: { b: { c: { d: { e: "خیلی عمیق" } } } } });
  assert.equal(deep.a.b.c.d, "[عمق زیاد]");
});

test("the diff records only what actually changed, with secrets masked", () => {
  const before = { title: "قبل", count: 1, untouched: "same", password: "a" };
  const after = { title: "بعد", count: 1, untouched: "same", password: "b" };

  const changes = diffDocuments(before, after);
  assert.deepEqual(Object.keys(changes).sort(), ["password", "title"]);
  assert.deepEqual(changes.title, { from: "قبل", to: "بعد" });
  // «عوض شد» اطلاعِ مفیدی است؛ مقدارها نه.
  assert.deepEqual(changes.password, { from: REDACTED, to: REDACTED });

  // بدونِ تغییر → null، نه یک شیء خالی که در UI ردیفِ بی‌معنا بسازد
  assert.equal(diffDocuments({ a: 1 }, { a: 1 }), null);
  // فیلدهای فنی هرگز diff نمی‌شوند
  assert.equal(diffDocuments({ __v: 1, updatedAt: "x" }, { __v: 2, updatedAt: "y" }), null);
});

test("a forged x-forwarded-for is ignored when the proxy is not trusted", () => {
  const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });

  const previous = process.env.TRUSTED_PROXY;
  try {
    process.env.TRUSTED_PROXY = "false";
    assert.equal(clientIpFrom(headers), "", "با پراکسیِ نامعتمد نباید IP پذیرفته شود");

    delete process.env.TRUSTED_PROXY;
    assert.equal(clientIpFrom(headers), "1.2.3.4", "اولین آدرسِ زنجیره باید گرفته شود");
  } finally {
    if (previous === undefined) delete process.env.TRUSTED_PROXY;
    else process.env.TRUSTED_PROXY = previous;
  }
});

test("the activity API is read-only and gated on admins.viewActivity", () => {
  assert.deepEqual(ADMIN_API_PERMISSIONS["/admin/activity"], {
    GET: "admins.viewActivity",
  });

  const source = readNormalized("src/app/api/admin/activity/route.js");
  assert.match(source, /requireAdminPermission\("admins\.viewActivity"\)/);

  // هیچ متدِ نوشتنی‌ای وجود ندارد — دفتر از مسیر API قابل تغییر نیست
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.doesNotMatch(
      source,
      new RegExp(`export async function ${method}\\b`),
      `روتِ فعالیت نباید ${method} داشته باشد`
    );
  }
});

test("the activity API validates ids, enums and sort instead of ignoring them", () => {
  const source = readNormalized("src/app/api/admin/activity/route.js");

  // شناسه‌ی بدشکل باید ۴۲۲ بگیرد، نه اینکه فیلتر بی‌صدا حذف شود و همه‌ی
  // رکوردها برگردند.
  assert.match(source, /if \(!isValidObjectId\(value\)\) \{/);
  assert.match(source, /status: 422/);
  // شناسه‌ی اقدام یا در رجیستری است یا دست‌کم شکلِ یک شناسه را دارد؛ رشته‌ی
  // دلخواه همچنان ۴۲۲ می‌گیرد و به کوئری نمی‌رسد.
  assert.match(source, /if \(!ACTIVITY_ACTIONS\[action\] && !ACTION_ID_PATTERN\.test\(action\)\)/);
  assert.match(source, /const ACTION_ID_PATTERN = /);
  assert.match(source, /if \(!ACTIVITY_RESULTS\.includes\(result\)\)/);
  // ترتیب از فهرستِ سفید می‌آید، نه از ورودی
  assert.match(source, /const SORTS = \{/);
  assert.match(source, /const sort = SORTS\[sortKey\]/);
  // سقفِ سختِ صفحه‌بندی
  assert.match(source, /Math\.min\(MAX_LIMIT/);
});

test("an admin without viewActivity sees neither the timeline nor the API", () => {
  const reader = computeEffectivePermissions({
    rolePermissions: ["dashboard.view", "admins.view"],
  });
  const auditor = computeEffectivePermissions({
    rolePermissions: ["dashboard.view", "admins.view", "admins.viewActivity"],
  });

  // صفحه‌ی جزئیات با admins.view باز می‌شود …
  assert.deepEqual(ADMIN_ROUTE_PERMISSIONS["/p-admin/users/admins/[adminId]"], ["admins.view"]);
  assert.equal(canAccessAdminRoute(reader, "/p-admin/users/admins/64f000000000000000000001"), true);

  // … ولی خطِ زمانی داخلش کلیدِ جدا می‌خواهد
  assert.equal(hasPermission(reader, "admins.viewActivity"), false);
  assert.equal(hasPermission(auditor, "admins.viewActivity"), true);

  const detail = readNormalized("src/components/admin/admins/AdminDetail.jsx");
  assert.match(detail, /\{can\("admins\.viewActivity"\) \? \(/);
  assert.match(detail, /دسترسی مشاهده تاریخچه فعالیت را ندارید/);
});

test("the timeline is read-only and renders no mutation control", () => {
  // کامنت‌ها کنار می‌روند: توضیحِ «مقادیر حذف شده‌اند» خودش شامل واژه است.
  const timeline = readNormalized(
    "src/components/admin/admins/ActivityTimeline.jsx"
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  // تنها دکمه‌ها: بازکردنِ جزئیات و صفحه‌بندی. هیچ حذف/ویرایشی نباید باشد.
  assert.doesNotMatch(timeline, /method:\s*["'](POST|PUT|PATCH|DELETE)["']/);
  assert.doesNotMatch(timeline, /حذف|ویرایش/);
  assert.match(timeline, /useSWR\(`\/api\/admin\/activity/);
});

test("every recorded action has a Persian label and a category", () => {
  for (const [action, meta] of Object.entries(ACTIVITY_ACTIONS)) {
    assert.ok(meta.label, `${action}: برچسب ندارد`);
    assert.ok(!/^[\x00-\x7F]+$/.test(meta.label), `${action}: برچسبِ غیرفارسی`);
    assert.ok(ACTIVITY_CATEGORIES[meta.category], `${action}: دسته‌ی ناشناخته`);
  }

  // اقدامِ ناشناخته نباید خالی رندر شود
  assert.equal(activityLabel("something.unknown"), "something.unknown");
  assert.equal(activityLabel(""), "—");
  assert.equal(activityCategory("something.unknown"), null);

  // هر نتیجه‌ی مدل برچسب دارد
  for (const result of ACTIVITY_RESULTS) {
    assert.ok(ACTIVITY_RESULT_LABELS[result], `${result}: برچسب ندارد`);
  }
});

test("routes that write their own record silence the generic one", () => {
  // وگرنه هر اقدام دو بار در خطِ زمانی می‌نشیند: یک‌بار «مجاز شد» و یک‌بار
  // خودِ اقدام.
  const instrumented = {
    "src/app/api/admin/roles/route.js": ["role.create"],
    "src/app/api/admin/roles/[id]/route.js": ["role.update", "role.delete"],
    "src/app/api/admin/users/[userId]/route.js": ["pickUserAction"],
  };

  for (const [file, markers] of Object.entries(instrumented)) {
    const source = readNormalized(file);
    assert.match(source, /audit: false/, `${file}: ثبتِ عمومی خاموش نشده`);
    assert.match(source, /auditor\(ctx, \{/, `${file}: از auditor استفاده نمی‌کند`);
    for (const marker of markers) {
      assert.ok(source.includes(marker), `${file}: ${marker} پیدا نشد`);
    }
  }
});

test("the user PATCH names the action after what actually changed", () => {
  const source = readNormalized("src/app/api/admin/users/[userId]/route.js");

  // مسدودسازی و تغییرِ موجودی باید در خطِ زمانی برجسته باشند، نه زیرِ یک
  // «ویرایش کاربر» عمومی گم شوند.
  assert.match(source, /if \("isBanned" in changes\) return changes\.isBanned\.to \? "user\.ban" : "user\.unban"/);
  assert.match(source, /if \("walletBalance" in changes\) return "user\.wallet\.adjust"/);
  assert.match(source, /if \("role" in changes\) return "user\.role\.change"/);
  assert.match(source, /return "user\.profile\.update"/);

  // و همه‌ی این نام‌ها برچسب دارند
  for (const action of [
    "user.ban",
    "user.unban",
    "user.wallet.adjust",
    "user.role.change",
    "user.profile.update",
  ]) {
    assert.ok(ACTIVITY_ACTIONS[action], `${action} در فهرستِ برچسب‌ها نیست`);
  }
});

/* ───────────────────────────────────────────────────────────────────────────
 * فاز ۸ — ماتریسِ مجوز و تست‌های منفی
 *
 * نسخه‌ی سریعِ همان ماتریسی که scripts/verifyPersonas.mjs روی HTTPِ واقعی
 * می‌سنجد. اینجا خالص است تا در هر اجرای تست بدونِ بالا آوردنِ سرور رگرسیون
 * بگیرد؛ آنجا اثباتِ سرتاسری است.
 * ─────────────────────────────────────────────────────────────────────────── */

const PERSONA_PERMISSIONS = {
  full: getAllPermissionKeys(),
  readOnly: computeEffectivePermissions({
    rolePermissions: [
      "dashboard.view",
      "products.view",
      "orders.view",
      "articles.view",
      "users.view",
    ],
  }),
  articlesOnly: computeEffectivePermissions({
    rolePermissions: ["dashboard.view", "articles.view", "articles.edit", "articles.create"],
  }),
  none: [],
};

test("the authorization matrix holds for all four personas", () => {
  const CASES = [
    ["/p-admin", { full: true, readOnly: true, articlesOnly: true, none: false }],
    ["/p-admin/admin-products", { full: true, readOnly: true, articlesOnly: false, none: false }],
    ["/p-admin/admin-products/add", { full: true, readOnly: false, articlesOnly: false, none: false }],
    ["/p-admin/admin-articles", { full: true, readOnly: true, articlesOnly: true, none: false }],
    ["/p-admin/admin-articles/new", { full: true, readOnly: false, articlesOnly: true, none: false }],
    ["/p-admin/admin-orders", { full: true, readOnly: true, articlesOnly: false, none: false }],
    ["/p-admin/users", { full: true, readOnly: true, articlesOnly: false, none: false }],
    ["/p-admin/users/admins", { full: true, readOnly: false, articlesOnly: false, none: false }],
    ["/p-admin/financial", { full: true, readOnly: false, articlesOnly: false, none: false }],
    ["/p-admin/admin-secondHands", { full: true, readOnly: false, articlesOnly: false, none: false }],
  ];

  const wrong = [];
  for (const [route, expected] of CASES) {
    for (const [persona, want] of Object.entries(expected)) {
      const got = canAccessAdminRoute(PERSONA_PERMISSIONS[persona], route);
      if (got !== want) wrong.push(`${persona} ${route}: ${got} (انتظار ${want})`);
    }
  }
  assert.deepEqual(wrong, []);
});

test("no persona can reach a route outside its own modules", () => {
  // برای هر پرسونا، *هر* روتی که کلیدش را ندارد باید بسته باشد — نه فقط
  // نمونه‌های بالا. این نسخه‌ی جامعِ همان ادعاست.
  for (const [persona, permissions] of Object.entries(PERSONA_PERMISSIONS)) {
    const held = new Set(permissions);
    for (const [route, required] of Object.entries(ADMIN_ROUTE_PERMISSIONS)) {
      const mode = ADMIN_ROUTE_ANY_MODE.has(route) ? "any" : "all";
      const shouldOpen =
        required.length > 0 &&
        (mode === "any"
          ? required.some((key) => held.has(key))
          : required.every((key) => held.has(key)));

      assert.equal(
        canAccessAdminRoute(permissions, route),
        shouldOpen,
        `${persona} → ${route}`
      );
    }
  }
});

test("the no-access persona is denied everywhere, with no exception", () => {
  const open = Object.keys(ADMIN_ROUTE_PERMISSIONS).filter((route) =>
    canAccessAdminRoute([], route)
  );
  assert.deepEqual(open, [], "پرسونای بدونِ دسترسی نباید هیچ روتی را باز کند");

  // و هیچ کلیدی هم ندارد
  for (const key of getAllPermissionKeys()) {
    assert.equal(hasPermission([], key), false);
  }
});

test("holding a view key never implies its write siblings", () => {
  // ارتقای بی‌صدا: کسی که فقط «مشاهده» دارد نباید هیچ اکشنِ نوشتنی بگیرد.
  const escalations = [];
  for (const mod of PERSONA_MODULES()) {
    const viewKey = `${mod.key}.view`;
    if (!mod.permissions.some((p) => p.fullKey === viewKey)) continue;

    const viewer = computeEffectivePermissions({ rolePermissions: [viewKey] });
    for (const perm of mod.permissions) {
      if (perm.fullKey === viewKey) continue;
      if (hasPermission(viewer, perm.fullKey)) escalations.push(`${viewKey} → ${perm.fullKey}`);
    }
  }
  assert.deepEqual(escalations, []);
});

function PERSONA_MODULES() {
  return PERMISSION_MODULES;
}

test("dependency pruning cannot be used to smuggle an action in", () => {
  // اکشنی که پیش‌نیازش را ندارد باید حذف شود، نه اینکه پیش‌نیاز خودکار
  // اضافه شود — وگرنه دادنِ products.delete به‌تنهایی، products.view را هم
  // هدیه می‌داد.
  const pruned = pruneUnsatisfiedDependencies(["products.delete"]);
  assert.deepEqual(pruned, [], "اکشنِ بی‌پیش‌نیاز باید حذف شود");

  // اما normalizePermissions (مسیرِ ذخیره) عمداً پیش‌نیاز را اضافه می‌کند
  assert.ok(normalizePermissions(["products.delete"]).includes("products.view"));
});

test("every module action is reachable by the full-access persona", () => {
  // نقطه‌ی مقابلِ تست‌های منفی: دسترسیِ کامل نباید سهواً چیزی را از دست بدهد.
  const missing = getAllPermissionKeys().filter(
    (key) => !hasPermission(PERSONA_PERMISSIONS.full, key)
  );
  assert.deepEqual(missing, []);
});

test("the persona verification script covers pages, APIs, nav and sneak attempts", () => {
  // اگر این اسکریپت لاغر شود، «راستی‌آزماییِ پایانی» بی‌معنا می‌شود.
  const source = readNormalized("scripts/verifyPersonas.mjs");

  assert.match(source, /MongoMemoryReplSet/, "باید روی دیتابیسِ موقت اجرا شود، نه production");
  assert.doesNotMatch(
    source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ""),
    /MONGODB_URI_TENADOR:\s*process\.env\.MONGODB_URI_TENADOR/,
    "نباید به دیتابیسِ production وصل شود"
  );

  for (const marker of ["PAGE_CASES", "API_CASES", "NAV_CASES", "sneaky"]) {
    assert.ok(source.includes(marker), `${marker} در اسکریپت نیست`);
  }
  // هر چهار پرسونا
  for (const persona of ["full", "readOnly", "articlesOnly", "none"]) {
    assert.ok(source.includes(`${persona}:`), `پرسونای ${persona} نیست`);
  }
  // توکن‌ها عمداً ادعای admin دارند تا بی‌اثری‌اش ثابت شود
  assert.match(source, /role: "admin"/);
});
