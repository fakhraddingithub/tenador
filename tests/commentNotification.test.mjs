/**
 * tests/commentNotification.test.mjs
 *
 * اعلانِ «نظر جدید» — روی یک mongodb واقعی با اسکیمای واقعیِ Notification.
 *
 * چرا واقعی: ادعای اصلیِ این قابلیت «هر نظر دقیقاً یک اعلان» است و تنها چیزی
 * که آن را تضمین می‌کند، ایندکسِ یکتای _id در خودِ مونگو است. با mock همان
 * چیزی که باید اثبات شود کنار می‌رود.
 *
 * اجرا: npm run test:comment-notification
 */

import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

register("./aliasHooks.mjs", import.meta.url);

const { default: Notification, NOTIFICATION_TYPES } = await import(
  "../models/Notification.js"
);
const {
  SECTION_BY_TYPE,
  buildReadQuery,
  getNotificationCounts,
  getRecentNotifications,
  markNotificationsRead,
  notifyNewComment,
  notifyNewTicket,
} = await import("../services/notificationService.js");
const {
  NOTIFICATION_TYPE_PERMISSIONS,
  constrainReadFilterToPermissions,
  filterNotificationPayload,
} = await import("../src/lib/apiPermissions.js");

const oid = () => new mongoose.Types.ObjectId();
const comment = () => ({ _id: oid(), user: oid() });

let mongod;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "comment-notification-test" });
}, { timeout: 180000 });

after(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await Notification.deleteMany({});
});

/* ── ثبت ───────────────────────────────────────────────────────────────── */

test("a new comment produces exactly one support notification", async () => {
  const c = comment();
  await notifyNewComment(c, { productName: "راکت تنیس" });

  const docs = await Notification.find({}).lean();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].type, "new_comment");
  assert.equal(String(docs[0]._id), String(c._id));
  assert.equal(String(docs[0].actor), String(c.user));
  assert.equal(docs[0].isRead, false);
  assert.equal(docs[0].link, "/p-admin/support?tab=comments");
  assert.match(docs[0].message, /راکت تنیس/);
  assert.equal(SECTION_BY_TYPE.new_comment, "support");
});

test("the same comment never mints a second notification", async () => {
  const c = comment();
  await notifyNewComment(c, { productName: "راکت" });
  await notifyNewComment(c, { productName: "راکت" }); // retry / double submit
  assert.equal(await Notification.countDocuments({}), 1);

  // و بعد از خوانده‌شدن هم دوباره خوانده‌نشده نمی‌شود
  await markNotificationsRead({ type: "new_comment" });
  await notifyNewComment(c, { productName: "راکت" });
  const [doc] = await Notification.find({}).lean();
  assert.equal(doc.isRead, true, "اعلانِ خوانده‌شده نباید با ثبتِ دوباره برگردد");
});

test("a reply is announced as a reply, and a nameless product degrades cleanly", async () => {
  await notifyNewComment(comment(), { productName: "کفش", reply: true });
  await notifyNewComment(comment(), {});

  const [reply, plain] = await Notification.find({}).sort({ createdAt: 1 }).lean();
  assert.match(reply.message, /پاسخ جدید/);
  assert.match(plain.message, /^نظر جدید ثبت شد/, "بدون نام محصول نباید «»ی خالی بماند");
});

test("a comment without an id is a no-op, never a thrown error", async () => {
  await notifyNewComment(null);
  await notifyNewComment({});
  assert.equal(await Notification.countDocuments({}), 0);
});

/* ── شمارش ─────────────────────────────────────────────────────────────── */

test("unseen comments join tickets in the support section total", async () => {
  await notifyNewTicket({ _id: oid(), subject: "الف", user: oid() });
  await notifyNewTicket({ _id: oid(), subject: "ب", user: oid() });
  await notifyNewComment(comment(), { productName: "الف" });
  await notifyNewComment(comment(), { productName: "ب" });
  await notifyNewComment(comment(), { productName: "ج" });

  const counts = await getNotificationCounts();
  assert.equal(counts.byType.new_comment, 3);
  assert.equal(counts.byType.new_ticket, 2);
  assert.equal(counts.sections.support, 5, "۲ تیکت + ۳ نظر = بَجِ پشتیبانی");
  assert.equal(counts.total, 5);
});

/* ── خوانده‌شدن ─────────────────────────────────────────────────────────── */

test("opening the comments tab clears only the comment notifications", async () => {
  const ticket = { _id: oid(), subject: "تیکت", user: oid() };
  await notifyNewTicket(ticket);
  await notifyNewComment(comment(), { productName: "الف" });
  await notifyNewComment(comment(), { productName: "ب" });

  const counts = await markNotificationsRead({ type: "new_comment" });
  assert.equal(counts.byType.new_comment, 0);
  assert.equal(counts.byType.new_ticket, 1, "تیکت‌ها نباید دست بخورند");
  assert.equal(counts.sections.support, 1);

  // پس از refresh هم صفر می‌ماند (از دیتابیس، نه از حالتِ کلاینت)
  const fresh = await getNotificationCounts();
  assert.equal(fresh.byType.new_comment, 0);
  assert.equal(fresh.sections.support, 1);

  // نظرِ بعدی دوباره شمرده می‌شود
  await notifyNewComment(comment(), { productName: "ج" });
  assert.equal((await getNotificationCounts()).byType.new_comment, 1);
});

test("marking one bell item read leaves the other comments unread", async () => {
  const a = comment();
  await notifyNewComment(a, { productName: "الف" });
  await notifyNewComment(comment(), { productName: "ب" });

  const counts = await markNotificationsRead({ ids: [String(a._id)] });
  assert.equal(counts.byType.new_comment, 1);
});

test("the read query accepts new_comment as a real type", () => {
  assert.ok(NOTIFICATION_TYPES.includes("new_comment"));
  const { query, allowed } = buildReadQuery({ type: "new_comment" });
  assert.ok(allowed);
  assert.deepEqual(query.type, { $in: ["new_comment"] });
});

/* ── زنگوله و دسترسی ────────────────────────────────────────────────────── */

test("the bell lists comment notifications alongside the rest", async () => {
  await notifyNewComment(comment(), { productName: "الف" });
  const { items, counts } = await getRecentNotifications(20);
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "new_comment");
  assert.equal(counts.total, 1);
});

test("comment notifications are gated behind comments.view", () => {
  assert.equal(NOTIFICATION_TYPE_PERMISSIONS.new_comment, "comments.view");

  const payload = {
    items: [{ type: "new_comment" }, { type: "new_ticket" }],
    counts: {
      byType: { new_comment: 3, new_ticket: 2 },
      sections: { orders: 0, coachCredits: 0, coachApplications: 0, support: 5 },
    },
    contactNew: 0,
  };

  const onlyComments = filterNotificationPayload(payload, ["comments.view"], SECTION_BY_TYPE);
  assert.deepEqual(onlyComments.items.map((i) => i.type), ["new_comment"]);
  assert.equal(onlyComments.counts.sections.support, 3, "تیکت‌های نادیدنی نباید در بَج جمع شوند");

  const onlyTickets = filterNotificationPayload(payload, ["tickets.view"], SECTION_BY_TYPE);
  assert.equal(onlyTickets.counts.byType.new_comment, 0);
  assert.equal(onlyTickets.counts.sections.support, 2);

  // ادمینی که نظرات را نمی‌بیند، نمی‌تواند اعلانش را هم خوانده‌شده کند
  assert.deepEqual(
    constrainReadFilterToPermissions({ type: "new_comment" }, ["tickets.view"]).type,
    []
  );
  assert.deepEqual(
    constrainReadFilterToPermissions({ type: "new_comment" }, ["comments.view"]).type,
    ["new_comment"]
  );
});
