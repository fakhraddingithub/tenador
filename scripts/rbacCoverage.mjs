#!/usr/bin/env node
/**
 * scripts/rbacCoverage.mjs — ماتریسِ پوششِ RBAC (فاز ۵)
 *
 * یک نگاشتِ ماشین‌خوان می‌سازد که پنج لایه را به هم وصل می‌کند:
 *
 *   صفحه‌ی پنل → اکشنِ دیده‌شده در UI → متد/روتِ API → کلیدِ دسترسی → آیتمِ منو
 *
 * هدفش «سبز شدن» نیست؛ پیدا کردنِ ناهم‌خوانی است. هر یافته یک کدِ ثابت دارد تا
 * بشود در تست به آن ارجاع داد و استثناهای پذیرفته‌شده را صریح ثبت کرد.
 *
 * اجرا:
 *   node scripts/rbacCoverage.mjs           گزارشِ خوانا (فارسی)
 *   node scripts/rbacCoverage.mjs --json    خروجیِ ماشین‌خوان
 *   node scripts/rbacCoverage.mjs --all     نمایشِ یافته‌های غیرمسدودکننده هم
 *
 * کدِ خروج: ۱ اگر یافته‌ی «مسدودکننده» وجود داشته باشد.
 */

import fs from "node:fs";
import path from "node:path";

import {
  ADMIN_ROUTE_PERMISSIONS,
  ADMIN_TAB_PERMISSIONS,
  PERMISSION_MODULES,
  PERMISSION_SECTIONS,
  RETIRED_PERMISSIONS,
  getAllPermissionKeys,
} from "../src/lib/permissions.js";

import {
  ADMIN_API_PERMISSIONS,
  PUBLIC_ADMIN_API_PERMISSIONS,
  SITE_SETTING_OWNERS,
} from "../src/lib/apiPermissions.js";

const ROOT = process.cwd();
const PAGES_ROOT = path.join(ROOT, "src/app/(Admin-Panel)/p-admin");
const API_ROOT = path.join(ROOT, "src/app/api");
const UI_ROOTS = [path.join(ROOT, "src/app"), path.join(ROOT, "src/components")];

/* ────────────────────────────────────────────────────────────────────────────
 * استثناهای پذیرفته‌شده — هر کدام با دلیل. اینجا تنها جای «قبول دارم» است.
 * ──────────────────────────────────────────────────────────────────────────── */

export const ACCEPTED = {
  /** صفحه‌هایی که عمداً در ADMIN_ROUTE_PERMISSIONS نیستند. */
  UNGATED_PAGES: {
    "/p-admin/403": "مقصدِ rewrite ـِ نگهبان؛ باید برای هر نشستی رندر شود.",
  },

  /** کلیدهایی که هیچ API ای اعمالشان نمی‌کند، با دلیلِ مشخص. */
  UI_ONLY_KEYS: {
    "analytics.export":
      "خروجیِ گزارش کاملاً در مرورگر از داده‌ی از پیش واکشی‌شده ساخته می‌شود؛ " +
      "هیچ روتی برای اعمالِ آن وجود ندارد. این گیت «راحتیِ رابط» است، نه کنترلِ امنیتی.",
  },

  /** ماژول‌هایی که اکشنِ درون‌صفحه‌ای ندارند و فقط با گاردِ روت محافظت می‌شوند. */
  ROUTE_GUARDED_MODULES: {
    dashboard:
      "تنها کلیدش dashboard.view است و هیچ اکشنِ نوشتنی ندارد؛ گاردِ روتِ /p-admin کافی است.",
    home:
      "صفحه‌ی /p-admin/admin-home فقط به تبِ «صفحه اصلی» در صفحات سایت ری‌دایرکت می‌کند و هیچ کنترلی رندر نمی‌کند.",
    navbar:
      "navbar.revalidate باطل‌سازیِ کش است و از سرور/ابزار صدا زده می‌شود؛ دکمه‌ای در پنل ندارد.",
    pages:
      "تنها اکشنش ویرایش است که روتِ مستقلِ خودش را دارد (/p-admin/admin-pages/[slug]) و لینکش با canRoute گیت شده؛ انتشار هم داخلِ همان ویرایشگر گیت است.",
  },

  /**
   * کلیدهایی که هنوز به هیچ چیز وصل نیستند و آگاهانه نگه داشته شده‌اند.
   * (`admins.viewActivity` در فاز ۶ وصل شد و از اینجا برداشته شده است.)
   */
  PLANNED_KEYS: {},

  /** کلیدهای `.view` که عمداً یک متدِ نوشتنی را هم باز می‌کنند. */
  VIEW_KEYS_WITH_WRITES: {
    "collections.view":
      "POST /admin/events/preview-products یک «خواندن» است که چون فیلترِ حجیم " +
      "می‌گیرد با POST پیاده شده؛ چیزی نمی‌نویسد.",
  },
};

/* ────────────────────────────────────────────────────────────────────────────
 * پیمایشِ فایل‌سیستم
 * ──────────────────────────────────────────────────────────────────────────── */

function walk(dir, test, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, test, out);
    else if (test(entry.name)) out.push(full);
  }
  return out;
}

const isPageFile = (name) => /^page\.(jsx?|tsx?)$/.test(name);
const isRouteFile = (name) => /^route\.(jsx?|tsx?)$/.test(name);
const isSourceFile = (name) => /\.(jsx?|tsx?)$/.test(name);

/** `/p-admin/...` از مسیرِ فایلِ صفحه. */
function pageRouteOf(file) {
  const rel = path.relative(PAGES_ROOT, path.dirname(file)).replace(/\\/g, "/");
  return rel && rel !== "." ? `/p-admin/${rel}` : "/p-admin";
}

/** کلیدِ manifest (مسیر بعد از `/api`) از مسیرِ فایلِ روت. */
function apiRouteOf(file) {
  const rel = path.relative(API_ROOT, path.dirname(file)).replace(/\\/g, "/");
  return `/${rel}`;
}

const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/* ────────────────────────────────────────────────────────────────────────────
 * جمع‌آوریِ حقایق
 * ──────────────────────────────────────────────────────────────────────────── */

function collectFacts() {
  const pageRoutes = new Set(walk(PAGES_ROOT, isPageFile).map(pageRouteOf));
  const apiRoutes = new Set(walk(API_ROOT, isRouteFile).map(apiRouteOf));

  // کلید → جاهایی که اعمال/استفاده می‌شود
  const byKey = new Map();
  const ensure = (key) => {
    if (!byKey.has(key)) {
      byKey.set(key, { key, routes: [], tabs: [], apis: [], ui: [], nav: [] });
    }
    return byKey.get(key);
  };
  getAllPermissionKeys().forEach(ensure);

  // ۱) روت‌های صفحه
  for (const [route, keys] of Object.entries(ADMIN_ROUTE_PERMISSIONS)) {
    for (const key of keys) ensure(key).routes.push(route);
  }
  for (const [tab, keys] of Object.entries(ADMIN_TAB_PERMISSIONS)) {
    for (const key of keys) ensure(key).tabs.push(tab);
  }

  // ۲) روت‌های API — شاملِ کلیدهایی که فقط از مسیرِ resolverِ شاخه‌ای می‌آیند
  const addApi = (table, label) => {
    for (const [route, methods] of Object.entries(table)) {
      for (const [method, value] of Object.entries(methods)) {
        if (typeof value === "string") {
          ensure(value).apis.push({ route, method, label, via: "direct" });
        } else if (value && Array.isArray(value.any)) {
          for (const key of value.any) {
            ensure(key).apis.push({ route, method, label, via: "any" });
          }
        } else if (value && value.branch) {
          for (const key of branchKeys(value.branch, method)) {
            ensure(key).apis.push({ route, method, label, via: `branch:${value.branch}` });
          }
        }
        // value === null → روتِ ادمینی بدونِ کلیدِ خاص (مثلِ زنگوله) — عمدی
      }
    }
  };
  addApi(ADMIN_API_PERMISSIONS, "admin");
  addApi(PUBLIC_ADMIN_API_PERMISSIONS, "public");

  // ۳) گیت‌های UI
  for (const root of UI_ROOTS) {
    for (const file of walk(root, isSourceFile)) {
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      if (rel.endsWith("src/components/admin/AdminPermissionProvider.jsx")) continue;
      const source = stripComments(fs.readFileSync(file, "utf8"));

      for (const m of source.matchAll(/\bcan\(\s*(\[[^\]]*\]|["'][^"']+["'])/g)) {
        for (const quoted of m[1].match(/["']([^"']+)["']/g) || []) {
          const key = quoted.slice(1, -1);
          if (byKey.has(key)) ensure(key).ui.push(rel);
        }
      }
      // canRoute("/p-admin/...") → کلیدهای همان روت
      for (const m of source.matchAll(/\bcanRoute\(\s*[`"']([^`"'$]*)/g)) {
        const literal = m[1];
        if (!literal.startsWith("/p-admin")) continue;
        const exact = ADMIN_ROUTE_PERMISSIONS[literal];
        if (exact) for (const key of exact) ensure(key).ui.push(`${rel} (canRoute)`);
      }
    }
  }

  // ۴) آیتم‌های منوی کناری
  const layout = fs.readFileSync(path.join(ROOT, "src/components/admin/Layout.jsx"), "utf8");
  const menuBlock = layout.slice(layout.indexOf("const menuItems"), layout.indexOf("export default"));
  const navHrefs = [...menuBlock.matchAll(/href:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  for (const href of navHrefs) {
    for (const key of ADMIN_ROUTE_PERMISSIONS[href] || []) ensure(key).nav.push(href);
  }

  return { pageRoutes, apiRoutes, byKey, navHrefs };
}

/**
 * کلیدهایی که یک resolverِ شاخه‌ای برای یک متدِ مشخص می‌تواند برگرداند.
 *
 * برای site-settings متد مهم است: GET به کلیدِ view نگاشت می‌شود و PUT به edit.
 * بدونِ این تفکیک، هر کلیدِ view به‌غلط «اجازه‌ی نوشتن» به‌نظر می‌رسید.
 */
function branchKeys(name, method) {
  if (name === "resolveSiteSettingPermission") {
    const action = method === "GET" ? "view" : "edit";
    return Object.values(SITE_SETTING_OWNERS)
      .map((owner) => owner[action])
      .filter(Boolean);
  }
  // بقیه‌ی resolverها کلیدهاشان را به‌صورت رشته‌ی ثابت در همان فایل دارند؛
  // برای دقت، از خودِ سورس استخراج می‌شوند.
  const source = stripComments(
    fs.readFileSync(path.join(ROOT, "src/lib/apiPermissions.js"), "utf8")
  );
  const start = source.indexOf(`export function ${name}(`);
  if (start === -1) return [];
  const end = source.indexOf("\nexport function ", start + 1);
  const body = source.slice(start, end === -1 ? undefined : end);
  const valid = new Set(getAllPermissionKeys());
  return [...new Set([...body.matchAll(/["']([a-zA-Z]+\.[a-zA-Z]+)["']/g)]
    .map((m) => m[1])
    .filter((key) => valid.has(key)))];
}

/* ────────────────────────────────────────────────────────────────────────────
 * ساختِ ماتریس + یافته‌ها
 * ──────────────────────────────────────────────────────────────────────────── */

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function buildCoverage() {
  const { pageRoutes, apiRoutes, byKey, navHrefs } = collectFacts();

  const moduleOf = new Map();
  const sectionOf = new Map();
  for (const section of PERMISSION_SECTIONS) {
    for (const mod of section.modules) {
      for (const perm of mod.permissions) {
        moduleOf.set(perm.fullKey, mod);
        sectionOf.set(perm.fullKey, section);
      }
    }
  }

  const matrix = [...byKey.values()]
    .map((row) => {
      const mod = moduleOf.get(row.key);
      const section = sectionOf.get(row.key);
      return {
        ...row,
        module: mod?.key ?? null,
        moduleTitle: mod?.title ?? null,
        section: section?.key ?? null,
        sectionTitle: section?.title ?? null,
        title: mod?.permissions.find((p) => p.fullKey === row.key)?.title ?? null,
        ui: [...new Set(row.ui)],
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const findings = [];
  const add = (code, blocking, subject, detail) =>
    findings.push({ code, blocking, subject, detail });

  /* ── صفحه ↔ manifest ───────────────────────────────────────────────── */
  for (const route of pageRoutes) {
    if (ACCEPTED.UNGATED_PAGES[route]) continue;
    if (!ADMIN_ROUTE_PERMISSIONS[route]) {
      add("PAGE_UNMAPPED", true, route, "صفحه‌ی پنل بدونِ ورودی در ADMIN_ROUTE_PERMISSIONS");
    }
  }
  for (const route of Object.keys(ADMIN_ROUTE_PERMISSIONS)) {
    if (!pageRoutes.has(route)) {
      add("ROUTE_STALE", true, route, "ورودیِ manifest بدونِ فایلِ صفحه");
    }
  }

  /* ── API ↔ manifest ───────────────────────────────────────────────── */
  for (const [table, label] of [
    [ADMIN_API_PERMISSIONS, "ADMIN_API_PERMISSIONS"],
    [PUBLIC_ADMIN_API_PERMISSIONS, "PUBLIC_ADMIN_API_PERMISSIONS"],
  ]) {
    for (const route of Object.keys(table)) {
      const bare = route.split("?")[0];
      if (!apiRoutes.has(bare)) {
        add("API_STALE", true, route, `${label}: روتی با این مسیر روی دیسک نیست`);
      }
    }
  }

  /* ── منو ↔ manifest ───────────────────────────────────────────────── */
  for (const href of navHrefs) {
    if (!ADMIN_ROUTE_PERMISSIONS[href]) {
      add("NAV_UNMAPPED", true, href, "آیتمِ منوی کناری بدونِ نگاشتِ روت — همیشه پنهان می‌ماند");
    }
  }

  /* ── متادیتای ماژول ↔ واقعیت ──────────────────────────────────────── */
  for (const mod of PERMISSION_MODULES) {
    if (mod.path) {
      const bare = mod.path.split("?")[0];
      if (!pageRoutes.has(bare)) {
        add("MODULE_PATH_STALE", false, mod.key, `path ماژول (${mod.path}) صفحه‌ای ندارد`);
      }
    }
    for (const api of mod.api || []) {
      // مسیرِ اعلام‌شده‌ی ماژول یک *پیشوند* است: `/api/admin/payments` روتِ
      // مستقیم ندارد ولی `/admin/payments/[id]/approve` زیرِ آن هست.
      const bare = api.replace(/^\/api/, "").split("?")[0];
      const covered = [...apiRoutes].some((r) => r === bare || r.startsWith(`${bare}/`));
      if (!covered) {
        add("MODULE_API_STALE", false, mod.key, `api ماژول (${api}) هیچ روتی زیرِ خود ندارد`);
      }
    }
  }

  /* ── کلیدها ───────────────────────────────────────────────────────── */

  // کلیدی که پیش‌نیازِ کلیدِ دیگری است «استفاده‌نشده» نیست: نبودنش باعث
  // می‌شود pruneUnsatisfiedDependencies اکشنِ وابسته را هم حذف کند.
  const prerequisiteOf = new Map();
  for (const mod of PERMISSION_MODULES) {
    for (const perm of mod.permissions) {
      for (const dep of perm.requires || []) {
        if (!prerequisiteOf.has(dep)) prerequisiteOf.set(dep, []);
        prerequisiteOf.get(dep).push(perm.fullKey);
      }
    }
  }

  for (const row of matrix) {
    const enforced = row.apis.length > 0;
    const routed = row.routes.length > 0 || row.tabs.length > 0;
    const inUi = row.ui.length > 0;
    const dependents = prerequisiteOf.get(row.key) || [];

    if (!enforced && !routed && !inUi) {
      if (dependents.length) {
        add(
          "KEY_PREREQUISITE_ONLY",
          false,
          row.key,
          `مستقیم اعمال نمی‌شود ولی پیش‌نیازِ ${dependents.join("، ")} است`
        );
        continue;
      }
      const planned = ACCEPTED.PLANNED_KEYS[row.key];
      add("KEY_UNUSED", !planned, row.key, planned || "کلیدی که هیچ‌جا اعمال یا استفاده نمی‌شود");
      continue;
    }

    if (!enforced && !routed) {
      const uiOnly = ACCEPTED.UI_ONLY_KEYS[row.key];
      add(
        "KEY_UI_ONLY",
        !uiOnly,
        row.key,
        uiOnly || "فقط در UI گیت شده — هیچ API یا روتی اعمالش نمی‌کند (امنیت نیست)"
      );
    }

    /*
     * «بیش‌ازحد گشاد» یعنی چه — تعریفِ دقیق:
     *   کلیدی با پسوندِ `.view` که متدِ نوشتنی را هم باز می‌کند.
     *
     * حالتِ برعکس (کلیدِ نوشتنی که یک GETِ پشتیبان را هم باز می‌کند) عمدی و
     * لازم است: مثلاً admins.create باید بتواند فهرستِ کاربرانِ کاندید را
     * بخواند، و userNotifications.send باید تعدادِ گیرنده را بشمارد. آن‌ها را
     * flag کردن، نویز تولید می‌کرد و علامتِ واقعی را دفن می‌کرد.
     */
    if (row.key.endsWith(".view")) {
      const writes = row.apis.filter((a) => WRITE_METHODS.has(a.method));
      if (writes.length) {
        const accepted = ACCEPTED.VIEW_KEYS_WITH_WRITES[row.key];
        add(
          "KEY_TOO_BROAD",
          !accepted,
          row.key,
          accepted ||
            `کلیدِ «مشاهده» متدِ نوشتنی را باز می‌کند: ${writes
              .map((a) => `${a.method} ${a.route}`)
              .join("، ")}`
        );
      }
    }
  }

  /* ── ماژول‌های بدونِ گیتِ UI ───────────────────────────────────────── */
  const uiKeys = new Set(matrix.filter((r) => r.ui.length).map((r) => r.key));
  for (const mod of PERMISSION_MODULES) {
    if (ACCEPTED.ROUTE_GUARDED_MODULES[mod.key]) continue;
    const writeKeys = mod.permissions.map((p) => p.fullKey).filter((k) => !k.endsWith(".view"));
    if (writeKeys.length && !writeKeys.some((k) => uiKeys.has(k))) {
      add("MODULE_NO_UI_GATE", true, mod.key, "ماژولِ نوشتنی بدونِ هیچ گیتِ can() در رابط");
    }
  }

  /* ── کلیدهای بازنشسته که هنوز در کد مانده‌اند ──────────────────────── */
  const registryPath = "src/lib/permissions.js";
  for (const retired of Object.keys(RETIRED_PERMISSIONS)) {
    for (const root of UI_ROOTS) {
      for (const file of walk(root, isSourceFile)) {
        const rel = path.relative(ROOT, file).replace(/\\/g, "/");
        if (rel === registryPath) continue;
        const source = stripComments(fs.readFileSync(file, "utf8"));
        if (source.includes(`"${retired}"`) || source.includes(`'${retired}'`)) {
          add("RETIRED_KEY_IN_USE", true, retired, `هنوز در ${rel} ارجاع دارد`);
        }
      }
    }
  }

  /* ── برچسب‌های تکراری در یک ماژول ─────────────────────────────────── */
  for (const mod of PERMISSION_MODULES) {
    const seen = new Map();
    for (const perm of mod.permissions) {
      const previous = seen.get(perm.title);
      if (previous) {
        add(
          "DUPLICATE_LABEL",
          false,
          `${mod.key}: ${perm.title}`,
          `دو کلید با عنوانِ یکسان: ${previous} و ${perm.fullKey}`
        );
      }
      seen.set(perm.title, perm.fullKey);
    }
  }

  return { matrix, findings };
}

/* ────────────────────────────────────────────────────────────────────────────
 * گزارش
 * ──────────────────────────────────────────────────────────────────────────── */

function report() {
  const { matrix, findings } = buildCoverage();
  const showAll = process.argv.includes("--all");

  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify({ matrix, findings }, null, 2));
    return findings.some((f) => f.blocking) ? 1 : 0;
  }

  const covered = matrix.filter((r) => r.apis.length || r.routes.length || r.tabs.length);
  console.log("ماتریسِ پوششِ RBAC");
  console.log("─".repeat(72));
  console.log(`کلیدها: ${matrix.length}   |   اعمال‌شده (API یا روت): ${covered.length}`);
  console.log(`ماژول‌ها: ${PERMISSION_MODULES.length}   |   بخش‌ها: ${PERMISSION_SECTIONS.length}`);
  console.log("");

  const blocking = findings.filter((f) => f.blocking);
  const advisory = findings.filter((f) => !f.blocking);

  const print = (list, heading) => {
    if (!list.length) return;
    console.log(heading);
    console.log("─".repeat(72));
    const byCode = new Map();
    for (const f of list) {
      if (!byCode.has(f.code)) byCode.set(f.code, []);
      byCode.get(f.code).push(f);
    }
    for (const [code, items] of byCode) {
      console.log(`\n[${code}] × ${items.length}`);
      for (const item of items) console.log(`  • ${item.subject} — ${item.detail}`);
    }
    console.log("");
  };

  print(blocking, "یافته‌های مسدودکننده");
  if (showAll) print(advisory, "یافته‌های اطلاعی (مسدودکننده نیستند)");
  else if (advisory.length) {
    console.log(`${advisory.length} یافته‌ی اطلاعی — با --all نمایش داده می‌شود.\n`);
  }

  if (!blocking.length) console.log("✓ هیچ یافته‌ی مسدودکننده‌ای نیست.");
  return blocking.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("rbacCoverage.mjs")) {
  process.exit(report());
}
