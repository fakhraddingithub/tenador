#!/usr/bin/env node
/**
 * scripts/verifyPersonas.mjs — راستی‌آزماییِ پایانی با چهار پرسونا (فاز ۸)
 *
 * ادعایی که تا امروز فقط تستِ واحد پشتش بود: «ادمینِ محدود واقعاً محدود است».
 * همه‌ی بررسی‌های زنده‌ی فازهای قبل با یک ادمینِ full-access انجام شده بود،
 * چون در دیتابیسِ واقعی عضویتِ محدودی وجود نداشت.
 *
 * این اسکریپت یک replica setِ در حافظه بالا می‌آورد، چهار پرسونا را seed
 * می‌کند، اپلیکیشنِ build‌شده را روی همان دیتابیس اجرا می‌کند و ماتریسِ
 * دسترسی را روی *پاسخ‌های واقعیِ HTTP* می‌سنجد.
 *
 * ⚠️ هیچ چیزی روی دیتابیسِ production نوشته نمی‌شود.
 *
 * اجرا:  node scripts/verifyPersonas.mjs
 * خروج:  ۱ اگر حتی یک خانه‌ی ماتریس با انتظار نخواند.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import {
  SUPER_ADMIN_ROLE_NAME,
  SUPER_ADMIN_SYSTEM_KEY,
} from "../src/lib/permissions.js";

const PORT = 4100;
const BASE = `http://localhost:${PORT}`;
const DB_NAME = "tenador-personas";

/* ────────────────────────────────────────────────────────────────────────────
 * پرسوناها
 * ──────────────────────────────────────────────────────────────────────────── */

const PERSONAS = {
  full: {
    label: "دسترسی کامل",
    roleName: SUPER_ADMIN_ROLE_NAME,
    fullAccess: true,
    permissions: [],
  },
  readOnly: {
    label: "فقط خواندنی",
    roleName: "ناظر (فقط خواندنی)",
    fullAccess: false,
    permissions: [
      "dashboard.view",
      "products.view",
      "orders.view",
      "articles.view",
      "users.view",
    ],
  },
  articlesOnly: {
    label: "محدود به مقالات",
    roleName: "ادمین مقالات",
    fullAccess: false,
    permissions: ["dashboard.view", "articles.view", "articles.edit", "articles.create"],
  },
  none: {
    label: "بدون دسترسی",
    roleName: null, // اصلاً عضویتی ندارد
    fullAccess: false,
    permissions: [],
  },
};

/* ────────────────────────────────────────────────────────────────────────────
 * ماتریسِ انتظار
 *
 * `page`: 200 و بدون پیامِ رد   |  `denied`: صفحه‌ی ۴۰۳  |  عدد: کدِ API
 * ──────────────────────────────────────────────────────────────────────────── */

const PAGE_CASES = [
  ["/p-admin", { full: "ok", readOnly: "ok", articlesOnly: "ok", none: "no-admin" }],
  ["/p-admin/admin-products", { full: "ok", readOnly: "ok", articlesOnly: "denied", none: "no-admin" }],
  ["/p-admin/admin-articles", { full: "ok", readOnly: "ok", articlesOnly: "ok", none: "no-admin" }],
  ["/p-admin/admin-orders", { full: "ok", readOnly: "ok", articlesOnly: "denied", none: "no-admin" }],
  ["/p-admin/users/admins", { full: "ok", readOnly: "denied", articlesOnly: "denied", none: "no-admin" }],
  ["/p-admin/financial", { full: "ok", readOnly: "denied", articlesOnly: "denied", none: "no-admin" }],
  ["/p-admin/admin-products/add", { full: "ok", readOnly: "denied", articlesOnly: "denied", none: "no-admin" }],
  ["/p-admin/admin-articles/new", { full: "ok", readOnly: "denied", articlesOnly: "ok", none: "no-admin" }],
  ["/p-admin/admin-secondHands", { full: "ok", readOnly: "denied", articlesOnly: "denied", none: "no-admin" }],
];

const API_CASES = [
  ["GET", "/api/admin/stats", { full: 200, readOnly: 200, articlesOnly: 200, none: 403 }],
  ["GET", "/api/admin/users", { full: 200, readOnly: 200, articlesOnly: 403, none: 403 }],
  ["GET", "/api/admin/articles", { full: 200, readOnly: 200, articlesOnly: 200, none: 403 }],
  ["GET", "/api/admin/activity", { full: 200, readOnly: 403, articlesOnly: 403, none: 403 }],
  ["GET", "/api/admin/admins", { full: 200, readOnly: 403, articlesOnly: 403, none: 403 }],
  ["GET", "/api/admin/analytics", { full: 200, readOnly: 403, articlesOnly: 403, none: 403 }],
  // نوشتنی‌ها — هیچ‌کدام نباید برای پرسونای بدونِ کلید حتی به اعتبارسنجی برسند
  ["DELETE", "/api/sports/000000000000000000000000", { full: 404, readOnly: 403, articlesOnly: 403, none: 403 }],
  // ۴۲۲ نه ۴۰۳: پرسونای full از گیت رد می‌شود و به اعتبارسنجی می‌رسد
  // (نامِ نقش الزامی است). همین تفاوت نشان می‌دهد گیت باز شده، نه اینکه
  // درخواست جایی زودتر مرده باشد.
  ["POST", "/api/admin/roles", { full: 422, readOnly: 403, articlesOnly: 403, none: 403 }],
  ["DELETE", "/api/product/000000000000000000000000/price", { full: 404, readOnly: 403, articlesOnly: 403, none: 403 }],
];

/** آیتم‌های سایدبار که نباید در HTMLِ پرسونای بی‌اجازه باشند. */
const NAV_CASES = [
  ["مدیریت مالی", { full: true, readOnly: false, articlesOnly: false }],
  ["کاربران", { full: true, readOnly: true, articlesOnly: false }],
  ["مقالات", { full: true, readOnly: true, articlesOnly: true }],
  ["بازار دست دوم", { full: true, readOnly: false, articlesOnly: false }],
];

/* ────────────────────────────────────────────────────────────────────────────
 * seed
 * ──────────────────────────────────────────────────────────────────────────── */

async function seed(db) {
  const now = new Date();
  const users = db.collection("users");
  const roles = db.collection("adminroles");
  const admins = db.collection("admins");

  const created = {};
  let n = 0;

  for (const [key, persona] of Object.entries(PERSONAS)) {
    n += 1;
    const user = await users.insertOne({
      provider: "local",
      name: persona.label,
      lastName: "تست",
      phone: `0912900${String(n).padStart(4, "0")}`,
      email: `${key}@personas.test`,
      password: "x".repeat(20),
      role: "user",
      isBanned: false,
      createdAt: now,
      updatedAt: now,
    });

    let roleId = null;
    if (persona.roleName) {
      const role = await roles.insertOne({
        name: persona.roleName,
        description: "پرسونای راستی‌آزمایی",
        permissions: persona.permissions,
        isSystem: persona.fullAccess,
        isFullAccess: persona.fullAccess,
        ...(persona.fullAccess ? { systemKey: SUPER_ADMIN_SYSTEM_KEY } : {}),
        createdAt: now,
        updatedAt: now,
      });
      roleId = role.insertedId;

      await admins.insertOne({
        user: user.insertedId,
        name: persona.label,
        username: `persona-${key}`,
        email: `${key}@personas.test`,
        title: "",
        role: roleId,
        permissionGrants: [],
        permissionDenials: [],
        permissions: [],
        isActive: true,
        activatedAt: now,
        source: "test",
        createdAt: now,
        updatedAt: now,
      });
    }

    created[key] = { userId: String(user.insertedId), roleId: roleId && String(roleId) };
  }

  return created;
}

/* ────────────────────────────────────────────────────────────────────────────
 * اجرا
 * ──────────────────────────────────────────────────────────────────────────── */

const waitFor = async (url, tries = 60) => {
  for (let i = 0; i < tries; i += 1) {
    try {
      await fetch(url, { method: "HEAD" });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
};

async function main() {
  console.log("راه‌اندازی replica setِ در حافظه…");
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = replSet.getUri(DB_NAME);

  await mongoose.connect(uri, { dbName: DB_NAME });
  const personas = await seed(mongoose.connection.db);
  await mongoose.disconnect();
  console.log("✓ چهار پرسونا seed شد (روی دیتابیسِ موقت، نه production)\n");

  // بدونِ shell و مستقیم روی باینریِ next: با shell، kill() فقط پوسته را
  // می‌کشد و سرور روی پورت باقی می‌ماند و اجرای بعدی را خراب می‌کند.
  const server = spawn(
    process.execPath,
    [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)],
    {
      cwd: process.cwd(),
      env: { ...process.env, MONGODB_URI_TENADOR: uri },
      stdio: "ignore",
    }
  );

  let failures = 0;

  try {
    if (!(await waitFor(BASE))) throw new Error("سرور بالا نیامد");

    const cookieFor = (key) =>
      `accessToken=${jwt.sign(
        // ادعای نقشِ ادمین داخلِ توکن عمداً گذاشته می‌شود تا ثابت شود بی‌اثر است
        { userId: personas[key].userId, role: "admin" },
        process.env.AccessTokenPrivateKey,
        { expiresIn: "1h", algorithm: "HS256" }
      )}`;

    const keys = Object.keys(PERSONAS);
    const pad = (s, n) => String(s).padEnd(n);

    /* ── صفحه‌ها ─────────────────────────────────────────────────────── */
    console.log("صفحه‌های پنل");
    console.log("─".repeat(88));
    console.log(pad("route", 40) + keys.map((k) => pad(k, 12)).join(""));

    const pageHtml = {}; // برای بررسیِ سایدبار
    for (const [route, expected] of PAGE_CASES) {
      const cells = [];
      for (const key of keys) {
        const res = await fetch(BASE + route, { headers: { Cookie: cookieFor(key) } });
        const html = await res.text();
        if (route === "/p-admin") pageHtml[key] = html;

        const actual = /به پنل مدیریت دسترسی ندارید/.test(html)
          ? "no-admin"
          : /دسترسی به این بخش ندارید/.test(html)
            ? "denied"
            : res.status === 200
              ? "ok"
              : `http-${res.status}`;

        const want = expected[key];
        const pass = actual === want;
        if (!pass) failures += 1;
        cells.push(pad(pass ? actual : `${actual}≠${want}`, 12));
      }
      console.log(pad(route, 40) + cells.join(""));
    }

    /* ── APIها ───────────────────────────────────────────────────────── */
    console.log("\nروت‌های API");
    console.log("─".repeat(88));
    console.log(pad("endpoint", 40) + keys.map((k) => pad(k, 12)).join(""));

    for (const [method, route, expected] of API_CASES) {
      const cells = [];
      for (const key of keys) {
        const res = await fetch(BASE + route, {
          method,
          headers: { Cookie: cookieFor(key), "Content-Type": "application/json" },
          ...(method === "POST" ? { body: "{}" } : {}),
        });
        const want = expected[key];
        const pass = res.status === want;
        if (!pass) failures += 1;
        cells.push(pad(pass ? res.status : `${res.status}≠${want}`, 12));
      }
      console.log(pad(`${method} ${route}`, 40) + cells.join(""));
    }

    /* ── سایدبار ─────────────────────────────────────────────────────── */
    console.log("\nآیتم‌های سایدبار در HTMLِ /p-admin");
    console.log("─".repeat(88));
    console.log(pad("nav item", 40) + ["full", "readOnly", "articlesOnly"].map((k) => pad(k, 12)).join(""));

    for (const [label, expected] of NAV_CASES) {
      const cells = [];
      for (const key of ["full", "readOnly", "articlesOnly"]) {
        const present = pageHtml[key]?.includes(label) || false;
        const want = expected[key];
        const pass = present === want;
        if (!pass) failures += 1;
        cells.push(pad(pass ? (present ? "دیده" : "پنهان") : `${present}≠${want}`, 12));
      }
      console.log(pad(label, 40) + cells.join(""));
    }

    /* ── تلاشِ مستقیم برای قابلیتِ پنهان ─────────────────────────────── */
    console.log("\nتلاشِ مستقیم برای قابلیتی که در UI دیده نمی‌شود");
    console.log("─".repeat(88));
    const sneaky = [
      ["articlesOnly", "DELETE", "/api/admin/articles/000000000000000000000000", 403],
      ["articlesOnly", "GET", "/api/admin/site-settings?key=bank_account_details", 403],
      ["readOnly", "PATCH", "/api/admin/users/000000000000000000000000", 403],
      ["readOnly", "POST", "/api/admin/roles", 403],
      ["none", "GET", "/api/admin/activity", 403],
    ];
    for (const [key, method, route, want] of sneaky) {
      const res = await fetch(BASE + route, {
        method,
        headers: { Cookie: cookieFor(key), "Content-Type": "application/json" },
        ...(method === "PATCH" || method === "POST" ? { body: "{}" } : {}),
      });
      const pass = res.status === want;
      if (!pass) failures += 1;
      console.log(
        `  ${pad(key, 14)} ${pad(`${method} ${route}`, 52)} ${res.status}${pass ? "" : ` ≠ ${want}`}`
      );
    }

    /* ── ناشناس ──────────────────────────────────────────────────────── */
    console.log("\nبدونِ نشست");
    console.log("─".repeat(88));
    const anonApi = await fetch(`${BASE}/api/admin/stats`);
    const anonPage = await fetch(`${BASE}/p-admin`, { redirect: "manual" });
    const anonApiPass = anonApi.status === 401;
    const anonPagePass = anonPage.status === 307;
    if (!anonApiPass) failures += 1;
    if (!anonPagePass) failures += 1;
    console.log(`  GET /api/admin/stats  → ${anonApi.status}${anonApiPass ? " (۴۰۱)" : " ≠ 401"}`);
    console.log(`  GET /p-admin          → ${anonPage.status}${anonPagePass ? " (ری‌دایرکت به ورود)" : " ≠ 307"}`);
  } finally {
    server.kill();
    await replSet.stop();
  }

  console.log("\n" + "─".repeat(88));
  if (failures) {
    console.log(`⛔ ${failures} خانه‌ی ماتریس با انتظار نخواند.`);
    process.exitCode = 1;
  } else {
    console.log("✓ همه‌ی خانه‌های ماتریسِ دسترسی مطابقِ انتظار.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("خطا:", error);
    process.exit(1);
  });
}
