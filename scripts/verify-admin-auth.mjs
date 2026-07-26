/**
 * scripts/verify-admin-auth.mjs
 *
 * تضمین می‌کند هیچ روتِ /api/admin/* بدون احراز هویتِ ادمین باقی نماند.
 *
 * دو حالت:
 *   node scripts/verify-admin-auth.mjs
 *       بررسی ایستا (بدون نیاز به سرور) — هر هندلرِ export شده باید در ابتدای
 *       بدنه‌اش requireAdmin() را صدا بزند.
 *
 *   node scripts/verify-admin-auth.mjs --runtime [baseUrl]
 *       علاوه بر بررسی ایستا، هر روت را بدون کوکی صدا می‌زند و انتظار ۴۰۱ دارد.
 *       پیش‌فرض baseUrl = http://localhost:3000
 *
 * خروجی غیرصفر یعنی حداقل یک روت محافظت‌نشده است.
 */

import fs from "node:fs";
import path from "node:path";

const ADMIN_API_DIR = path.join(process.cwd(), "src", "app", "api", "admin");
const HANDLER_RE =
  /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{/g;

// چند بایت ابتدای بدنه‌ی هندلر که گیت باید داخل آن باشد
const GUARD_WINDOW = 400;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name === "route.js") out.push(p);
  }
  return out;
}

function rel(file) {
  return file.split(`${path.sep}api${path.sep}`)[1].split(path.sep).join("/");
}

/** مسیر URL روت را از مسیر فایل می‌سازد؛ [param] با یک مقدار نمونه پر می‌شود */
function urlFor(file) {
  const segments = rel(file).replace(/\/route\.js$/, "").split("/");
  return (
    "/api/" +
    segments
      .map((s) => (s.startsWith("[") ? "000000000000000000000000" : s))
      .join("/")
  );
}

/* ─────────────────────────  بررسی ایستا  ───────────────────────── */

const files = walk(ADMIN_API_DIR).sort();
const unguarded = [];
const routes = [];
let handlerCount = 0;

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const methods = [];

  for (const m of src.matchAll(HANDLER_RE)) {
    handlerCount++;
    methods.push(m[1]);
    const bodyStart = m.index + m[0].length;
    const window = src.slice(bodyStart, bodyStart + GUARD_WINDOW);
    if (!/requireAdmin\s*\(\s*\)/.test(window)) {
      unguarded.push(`${m[1].padEnd(6)} ${rel(file)}`);
    }
  }

  if (methods.length) routes.push({ url: urlFor(file), methods });
}

console.log(
  `بررسی ایستا: ${handlerCount} هندلر در ${files.length} فایل زیر /api/admin`
);

if (unguarded.length) {
  console.error(`\n✗ ${unguarded.length} هندلرِ محافظت‌نشده:`);
  for (const u of unguarded) console.error(`   ${u}`);
} else {
  console.log("✓ همه‌ی هندلرها requireAdmin() را در ابتدای بدنه صدا می‌زنند");
}

/* ─────────────────────────  بررسی زمان اجرا  ───────────────────────── */

let runtimeFailures = [];

if (process.argv.includes("--runtime")) {
  const baseUrl =
    process.argv[process.argv.indexOf("--runtime") + 1]?.startsWith("http")
      ? process.argv[process.argv.indexOf("--runtime") + 1]
      : "http://localhost:3000";

  console.log(`\nبررسی زمان اجرا روی ${baseUrl} (بدون کوکی — انتظار ۴۰۱)`);

  for (const { url, methods } of routes) {
    for (const method of methods) {
      const target = `${baseUrl}${url}`;
      try {
        const res = await fetch(target, {
          method,
          headers: { "Content-Type": "application/json" },
          // بدنه‌ی خالی برای متدهای نوشتنی تا خطای پارس رخ ندهد
          ...(method === "GET" || method === "DELETE"
            ? {}
            : { body: "{}" }),
          redirect: "manual",
        });

        // ۴۰۱ مطلوب است. ۴۰۳ هم «رد شده» محسوب می‌شود (روت‌های قدیمی‌تر).
        if (res.status !== 401 && res.status !== 403) {
          runtimeFailures.push(
            `${method.padEnd(6)} ${url}  →  ${res.status} (انتظار ۴۰۱)`
          );
        }
      } catch (err) {
        runtimeFailures.push(`${method.padEnd(6)} ${url}  →  خطا: ${err.message}`);
      }
    }
  }

  if (runtimeFailures.length) {
    console.error(`\n✗ ${runtimeFailures.length} پاسخِ غیرمنتظره:`);
    for (const f of runtimeFailures) console.error(`   ${f}`);
  } else {
    console.log("✓ همه‌ی روت‌ها بدون نشستِ ادمین رد شدند");
  }
}

const failed = unguarded.length + runtimeFailures.length;
if (failed) {
  console.error(`\n${failed} مورد ناموفق.`);
  process.exit(1);
}
console.log("\nهمه‌ی بررسی‌ها موفق.");
