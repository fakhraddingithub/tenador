/**
 * scripts/verify-admin-auth.mjs
 *
 * تضمین می‌کند مجوزدهیِ روت‌های ادمین واقعاً و دقیقاً اعمال شده باشد.
 *
 * فاز ۱ فقط بررسی می‌کرد «هر هندلر requireAdmin() را صدا می‌زند». فاز ۲ سه
 * چیز بیشتر را اثبات می‌کند:
 *
 *   ۱) هر هندلرِ /api/admin دقیقاً همان کلیدی را صدا بزند که در
 *      src/lib/apiPermissions.js ثبت شده — برابریِ کامل، نه شباهت. بدون این،
 *      «manifest» و رشته‌های داخل فایل‌ها دو منبع حقیقتِ واگرا می‌شوند.
 *   ۲) هندلرهای BRANCH (که کلیدشان به بدنه/کوئری وابسته است) هم بی‌بررسی
 *      نمانند: باید گیت را صدا بزنند و هر کلیدی که استفاده می‌کنند معتبر باشد.
 *   ۳) هیچ هندلرِ *تغییردهنده‌ای* در کلِ src/app/api بدون احراز هویت نماند —
 *      وگرنه گیت کردنِ /api/admin نمایشی است (مثلاً POST /api/product/create
 *      کلید products.create را دور می‌زد).
 *
 * حالت‌ها:
 *   node scripts/verify-admin-auth.mjs
 *       بررسی ایستا (بدون نیاز به سرور).
 *
 *   node scripts/verify-admin-auth.mjs --runtime [baseUrl]
 *       علاوه بر بررسی ایستا، هر روت را بدون کوکی صدا می‌زند و انتظار ۴۰۱ دارد.
 *       پیش‌فرض baseUrl = http://localhost:3000
 *
 * خروجی غیرصفر یعنی حداقل یک تخلف وجود دارد.
 */

import fs from "node:fs";
import path from "node:path";
import {
  ADMIN_API_PERMISSIONS,
  PUBLIC_ADMIN_API_PERMISSIONS,
  SITE_SETTING_OWNERS,
  isBranch,
} from "../src/lib/apiPermissions.js";
import { getAllPermissionKeys } from "../src/lib/permissions.js";

const API_DIR = path.join(process.cwd(), "src", "app", "api");
const ADMIN_API_DIR = path.join(API_DIR, "admin");
const GATE = "requireAdminPermission";
const VALID_KEYS = new Set(getAllPermissionKeys());
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const errors = [];
const notes = [];

/* ── کمکی‌ها ─────────────────────────────────────────────────────────── */

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name === "route.js") out.push(p);
  }
  return out;
}

/** مسیرِ روت به شکل manifest: `/admin/orders/[orderId]` */
function routeOf(file) {
  return "/" + path.relative(API_DIR, path.dirname(file)).split(path.sep).join("/");
}

/** بدنه‌ی هر هندلرِ export شده. */
function handlerBodies(source) {
  const found = [];
  for (const method of METHODS) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\(`);
    const m = source.match(re);
    if (m) found.push({ method, start: m.index });
  }
  found.sort((a, b) => a.start - b.start);
  return found.map((h, i) => ({
    method: h.method,
    body: source.slice(h.start, i + 1 < found.length ? found[i + 1].start : source.length),
  }));
}

/** همه‌ی آرگومان‌های اولِ فراخوانی‌های گیت در یک بدنه. */
function gateCalls(body) {
  const calls = [];
  const re = new RegExp(`${GATE}\\s*\\(([^)]*)\\)`, "g");
  let m;
  while ((m = re.exec(body))) {
    calls.push(m[1].trim());
  }
  return calls;
}

/**
 * فقط آرگومانِ *اول* — تا رشته‌های داخلِ آبجکتِ options (مثل `{ mode: "any" }`)
 * به‌اشتباه کلیدِ دسترسی شمرده نشوند.
 */
function firstArg(argString) {
  let depth = 0;
  for (let i = 0; i < argString.length; i += 1) {
    const c = argString[i];
    if (c === "[" || c === "{" || c === "(") depth += 1;
    else if (c === "]" || c === "}" || c === ")") depth -= 1;
    else if (c === "," && depth === 0) return argString.slice(0, i);
  }
  return argString;
}

/** رشته‌لیترال‌های داخل آرگومانِ اول. */
function literals(arg) {
  return [...firstArg(arg).matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

/** آیا مقدار «هر یک از این کلیدها» است؟ */
function isAnyOf(value) {
  return !!value && typeof value === "object" && Array.isArray(value.any);
}

/** نمایشِ متعارفِ مقدارِ manifest برای مقایسه. */
function expectedLiteral(value) {
  if (value === null) return null; // ANY_ADMIN → بدون آرگومان
  if (isAnyOf(value)) return [...value.any].sort();
  return Array.isArray(value) ? [...value].sort() : [value];
}

/* ── ۱) روت‌های /api/admin ────────────────────────────────────────────── */

const adminFiles = walk(ADMIN_API_DIR);
const seenRoutes = new Set();
let adminHandlerCount = 0;

for (const file of adminFiles) {
  const route = routeOf(file);
  const source = fs.readFileSync(file, "utf8");
  const handlers = handlerBodies(source);
  const entry = ADMIN_API_PERMISSIONS[route];
  seenRoutes.add(route);

  if (!entry) {
    errors.push(`${route}: در src/lib/apiPermissions.js ثبت نشده است.`);
    continue;
  }

  for (const { method, body } of handlers) {
    adminHandlerCount += 1;
    const label = `${method} ${route}`;

    if (!(method in entry)) {
      errors.push(`${label}: در manifest برای این متد کلیدی ثبت نشده است.`);
      continue;
    }

    const calls = gateCalls(body);
    if (!calls.length) {
      errors.push(`${label}: گیت ${GATE}() را صدا نمی‌زند.`);
      continue;
    }

    const expected = entry[method];

    // ── هندلرهای شاخه‌ای ──────────────────────────────────────────────
    // «کلید از متغیر می‌آید» دیگر قابل قبول نیست: باید دقیقاً همان resolverِ
    // اعلام‌شده در manifest صدا زده شود و خروجی‌اش به گیت داده شود.
    if (isBranch(expected)) {
      const resolver = expected.branch;

      if (!new RegExp(`import\\s*\\{[^}]*\\b${resolver}\\b`, "s").test(source)) {
        errors.push(`${label}: «${resolver}» از src/lib/apiPermissions ایمپورت نشده.`);
        continue;
      }

      // نامِ متغیری که خروجیِ resolver در آن می‌نشیند
      const assign = body.match(
        new RegExp(`(?:const|let)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${resolver}\\s*\\(`)
      );
      if (!assign) {
        errors.push(
          `${label}: خروجیِ «${resolver}» باید در یک متغیر ذخیره شود تا قابل بررسی باشد.`
        );
        continue;
      }
      const v = assign[1];

      // ۱) گیتِ هویت باید *پیش از* resolver بیاید، وگرنه درخواستِ ناشناس
      //    به‌جای ۴۰۱ یک ۴۰۳ ناشی از شکلِ بدنه می‌گیرد.
      const identityAt = body.search(new RegExp(`${GATE}\\s*\\(\\s*\\)`));
      if (identityAt === -1) {
        errors.push(
          `${label}: BRANCH باید اول ${GATE}() بدونِ آرگومان را صدا بزند تا ناشناس ۴۰۱ بگیرد.`
        );
      } else if (identityAt > assign.index) {
        errors.push(`${label}: گیتِ هویت باید پیش از فراخوانیِ «${resolver}» باشد.`);
      }

      // ۲) گیتی که خروجیِ resolver را می‌گیرد — لنگرِ سنجشِ ترتیب همین است،
      //    نه اولین فراخوانیِ گیت در بدنه.
      const wired = new RegExp(
        `${GATE}\\s*\\(\\s*${v}\\.permissions\\s*,\\s*\\{[^}]*mode\\s*:\\s*${v}\\.mode`
      );
      const wiredAt = body.search(wired);
      if (wiredAt === -1) {
        errors.push(
          `${label}: گیت باید دقیقاً با \`${v}.permissions\` و \`{ mode: ${v}.mode }\` صدا زده شود.`
        );
      }

      // ۳) رد باید *قبل از همان گیت* به ۴۰۳ تبدیل شود
      const denyGuard = new RegExp(`if\\s*\\(\\s*!\\s*${v}\\.allowed\\s*\\)`);
      const denyAt = body.search(denyGuard);
      if (denyAt === -1) {
        errors.push(
          `${label}: باید پیش از گیت، \`if (!${v}.allowed)\` را ۴۰۳ کند (آرایه‌ی خالی خودبه‌خود allow می‌شود).`
        );
      } else {
        if (!/return\s+forbidden\s*\(\s*\)/.test(body.slice(denyAt, denyAt + 160))) {
          errors.push(`${label}: شاخه‌ی !${v}.allowed باید forbidden() برگرداند.`);
        }
        if (wiredAt !== -1 && denyAt > wiredAt) {
          errors.push(
            `${label}: بررسیِ !${v}.allowed بعد از گیتِ کلید آمده، نه قبل از آن.`
          );
        }
        if (denyAt < assign.index) {
          errors.push(`${label}: بررسیِ !${v}.allowed پیش از خودِ resolver آمده.`);
        }
      }

      // ۳) هیچ کلیدِ ثابتی در گیتِ شاخه‌ای مجاز نیست
      for (const key of calls.flatMap(literals)) {
        errors.push(`${label}: BRANCH نباید کلیدِ ثابت «${key}» بدهد.`);
      }
      continue;
    }

    // ── هر ادمینِ معتبر (بدون کلید) ───────────────────────────────────
    if (expected === null) {
      if (calls.some((c) => c.length > 0)) {
        errors.push(
          `${label}: manifest می‌گوید «هر ادمین» ولی گیت با آرگومان صدا زده شده.`
        );
      }
      continue;
    }

    // ── کلید(های) ثابت: برابریِ کامل ─────────────────────────────────
    const want = expectedLiteral(expected);
    const got = literals(calls[0]).sort();
    if (JSON.stringify(want) !== JSON.stringify(got)) {
      errors.push(
        `${label}: کلیدِ فایل با manifest برابر نیست — manifest=[${want.join(",")}] فایل=[${got.join(",")}]`
      );
    }
    // «هر یک از» باید صریحاً mode: "any" بدهد، وگرنه در عمل «همه‌ی کلیدها»
    // لازم می‌شود و دسترسی سخت‌گیرانه‌تر از manifest خواهد بود.
    if (isAnyOf(expected) && !/mode\s*:\s*["']any["']/.test(body)) {
      errors.push(`${label}: manifest «any» است ولی گیت mode:"any" نمی‌دهد.`);
    }
    for (const key of got) {
      if (!VALID_KEYS.has(key)) {
        errors.push(`${label}: کلید «${key}» در رجیستری وجود ندارد.`);
      }
    }
  }
}

// ورودی‌های بی‌استفاده‌ی manifest
for (const route of Object.keys(ADMIN_API_PERMISSIONS)) {
  if (!seenRoutes.has(route)) {
    errors.push(`${route}: در manifest هست ولی فایل روتی ندارد (ورودیِ کهنه).`);
  }
}

/* ── ۲) روت‌های ادمینیِ بیرون از /api/admin ───────────────────────────── */

let publicHandlerCount = 0;
for (const [route, methods] of Object.entries(PUBLIC_ADMIN_API_PERMISSIONS)) {
  const file = path.join(API_DIR, ...route.split("/").filter(Boolean), "route.js");
  if (!fs.existsSync(file)) {
    errors.push(`${route}: در manifestِ عمومی هست ولی فایل ندارد.`);
    continue;
  }
  const source = fs.readFileSync(file, "utf8");
  const bodies = Object.fromEntries(
    handlerBodies(source).map((h) => [h.method, h.body])
  );

  for (const [method, key] of Object.entries(methods)) {
    publicHandlerCount += 1;
    const label = `${method} ${route}`;
    const body = bodies[method];
    if (!body) {
      errors.push(`${label}: هندلر وجود ندارد (ورودیِ کهنه).`);
      continue;
    }
    const calls = gateCalls(body);
    if (!calls.length) {
      errors.push(`${label}: بدون گیت — این روتِ ادمینی محافظت نشده است.`);
      continue;
    }
    const got = literals(calls[0]).sort();
    const want = expectedLiteral(key);
    if (JSON.stringify(want) !== JSON.stringify(got)) {
      errors.push(
        `${label}: کلیدِ فایل با manifest برابر نیست — manifest=[${want.join(",")}] فایل=[${got.join(",")}]`
      );
    }
    for (const k of got) {
      if (!VALID_KEYS.has(k)) errors.push(`${label}: کلید «${k}» در رجیستری نیست.`);
    }
  }
}

/* ── ۳) دامنه ─────────────────────────────────────────────────────────
 *
 * عمداً هیچ اسکنِ سراسری‌ای روی src/app/api انجام نمی‌شود.
 * دامنه‌ی فاز ۲ دقیقاً دو مجموعه است:
 *   • همه‌ی روت‌های /api/admin  (بخش ۱)
 *   • روت‌های صریحِ PUBLIC_ADMIN_API_PERMISSIONS (بخش ۲) که با یکی از دو
 *     معیار انتخاب شده‌اند: شاهدِ مصرف در p-admin، یا معناشناسیِ منحصراً
 *     مدیریتی (مثل /api/bans و /api/navbar POST که caller ندارند ولی
 *     ماهیتاً مدیریتی‌اند).
 * روت‌های عمومیِ نامرتبط (سبد خرید، نظرات، آدرس، /api/upload که کاربرِ عادی
 * هم از آن استفاده می‌کند و ...) نه بررسی و نه تغییر داده می‌شوند.
 */

/* ── ۴) صحتِ نگاشتِ کلیدهای تنظیمات ───────────────────────────────────── */

for (const [settingKey, owner] of Object.entries(SITE_SETTING_OWNERS)) {
  for (const [action, permission] of Object.entries(owner)) {
    if (!VALID_KEYS.has(permission)) {
      errors.push(
        `SITE_SETTING_OWNERS["${settingKey}"].${action}: کلید «${permission}» در رجیستری نیست.`
      );
    }
  }
}

/* ── گزارش ────────────────────────────────────────────────────────────── */

console.log(
  `بررسی ایستا: ${adminHandlerCount} هندلر در ${adminFiles.length} فایل زیر /api/admin` +
    ` + ${publicHandlerCount} هندلرِ ادمینیِ بیرونی`
);

for (const note of notes) console.log(`  ℹ ${note}`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} تخلف:`);
  for (const e of errors) console.error(`  • ${e}`);
  process.exitCode = 1;
} else {
  console.log("✓ هر هندلر دقیقاً همان کلیدِ manifest را اعمال می‌کند.");
  console.log(
    "✓ همه‌ی روت‌های داخلِ دامنه (کلِ /api/admin + روت‌های صریحِ manifestِ عمومی) گیت دارند."
  );
  console.log(
    "  توجه: روت‌های عمومیِ بیرون از manifest عمداً بررسی نمی‌شوند؛ این ادعا شاملشان نیست."
  );
  console.log("\nهمه‌ی بررسی‌ها موفق.");
}
