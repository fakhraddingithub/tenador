import test from "node:test";
import assert from "node:assert/strict";
import { isArticlePubliclyVisible } from "../utils/articleRoutes.js";

const NOW = new Date("2026-08-17T12:00:00.000Z");
const PAST = "2026-08-01T10:00:00.000Z";
const FUTURE = "2026-09-01T10:00:00.000Z";

// این پیش‌بین باید دقیقاً هم‌تراز با publicArticleFilter بماند؛ هر اختلافی یعنی
// پنل ادمین لینکِ عمومی را برای مقاله‌ای نشان می‌دهد که سایت ۴۰۴ می‌دهد.

test("مقاله‌ی منتشرشده با تاریخِ گذشته عمومی است", () => {
  assert.equal(isArticlePubliclyVisible({ status: "published", publishedAt: PAST }, NOW), true);
});

test("مقاله‌ی منتشرشده بدون تاریخ عمومی است", () => {
  assert.equal(isArticlePubliclyVisible({ status: "published", publishedAt: null }, NOW), true);
  assert.equal(isArticlePubliclyVisible({ status: "published", publishedAt: "" }, NOW), true);
});

test("مقاله‌ی منتشرشده با تاریخِ آینده هنوز عمومی نیست", () => {
  assert.equal(isArticlePubliclyVisible({ status: "published", publishedAt: FUTURE }, NOW), false);
});

test("زمان‌بندی‌شده با تاریخِ گذشته عمومی است", () => {
  assert.equal(isArticlePubliclyVisible({ status: "scheduled", publishedAt: PAST }, NOW), true);
});

test("زمان‌بندی‌شده با تاریخِ آینده عمومی نیست", () => {
  assert.equal(isArticlePubliclyVisible({ status: "scheduled", publishedAt: FUTURE }, NOW), false);
});

test("زمان‌بندی‌شده بدون تاریخ عمومی نیست", () => {
  assert.equal(isArticlePubliclyVisible({ status: "scheduled", publishedAt: null }, NOW), false);
});

test("پیش‌نویس، بازبینی و آرشیو هرگز عمومی نیستند", () => {
  for (const status of ["draft", "review", "archived"]) {
    assert.equal(isArticlePubliclyVisible({ status, publishedAt: PAST }, NOW), false, status);
    assert.equal(isArticlePubliclyVisible({ status, publishedAt: null }, NOW), false, status);
  }
});

test("مقاله‌ی حذف‌شده عمومی نیست", () => {
  assert.equal(isArticlePubliclyVisible({ status: "published", publishedAt: PAST, deletedAt: "2026-08-10T00:00:00.000Z" }, NOW), false);
});

test("ورودی نامعتبر یا خالی عمومی نیست", () => {
  assert.equal(isArticlePubliclyVisible(null, NOW), false);
  assert.equal(isArticlePubliclyVisible(undefined, NOW), false);
  assert.equal(isArticlePubliclyVisible({}, NOW), false);
  assert.equal(isArticlePubliclyVisible({ status: "published", publishedAt: "not-a-date" }, NOW), false);
});

test("تاریخِ محلیِ ویرایشگر (بدون منطقه‌ی زمانی) درست تفسیر می‌شود", () => {
  // ArticleEditor مقدار publishedAt را با isoLocal به "YYYY-MM-DDTHH:mm" تبدیل
  // می‌کند؛ new Date روی این رشته زمانِ محلی را می‌فهمد.
  const localPast = new Date(NOW.getTime() - 86400000);
  const pad = (n) => String(n).padStart(2, "0");
  const local = `${localPast.getFullYear()}-${pad(localPast.getMonth() + 1)}-${pad(localPast.getDate())}T${pad(localPast.getHours())}:${pad(localPast.getMinutes())}`;
  assert.equal(isArticlePubliclyVisible({ status: "published", publishedAt: local }, NOW), true);
});
