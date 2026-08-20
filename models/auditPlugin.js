/**
 * models/auditPlugin.js
 *
 * پلاگینِ سراسریِ Mongoose که «واقعاً چه چیزی در دیتابیس عوض شد» را می‌گیرد.
 *
 * ── چرا اینجا و نه در روت‌ها ─────────────────────────────────────────────
 * گیتِ دسترسی پیش از هندلر اجرا می‌شود و فقط کلیدِ دسترسی را می‌بیند، پس
 * رکوردش ناچار عمومی است («اقدامِ نوشتنیِ مجاز»). طرفِ دیگر، ۱۲۱ روتِ ادمین
 * وجود دارد و ابزارِ ممیزی‌ای که باید در هر کدام دستی صدا زده شود، همان روزی
 * که یک روتِ جدید اضافه شود ناقص می‌گردد.
 *
 * تنها لایه‌ای که هم *همه‌ی* نوشتن‌ها از آن رد می‌شوند و هم مقدارِ قبل و بعد را
 * می‌بیند، خودِ Mongoose است. یک پلاگین اینجا یعنی: پوششِ کامل بدونِ تغییر در
 * هیچ هندلری، و رکوردی که «عملیاتِ سمتِ سرور» را نشان می‌دهد نه «دکمه‌ای که
 * فشرده شد».
 *
 * ── سه نکته‌ی درستی ──────────────────────────────────────────────────────
 * ۱. هوک‌ها فقط وقتی کار می‌کنند که یک *دامنه‌ی ممیزی* باز باشد؛ دامنه را
 *    گیتِ ادمین برای درخواست‌های نوشتنی باز می‌کند. ترافیکِ عمومیِ سایت،
 *    ورکرها و اسکریپت‌ها هیچ هزینه‌ای نمی‌دهند و هیچ رکوردی نمی‌سازند.
 * ۲. رویداد فقط از هوکِ `post` بیرون می‌آید، یعنی نوشتن واقعاً انجام شده. اگر
 *    نوشتن داخلِ تراکنشی بوده که بعداً abort شد، در پایانِ درخواست از روی
 *    وضعیتِ session کنار گذاشته می‌شود (adminAuditScope.isRolledBack).
 * ۳. هیچ هوکی throw نمی‌کند. یک استثنا در post-hook عملیاتِ اصلی را شکست
 *    می‌دهد؛ ممیزی هرگز نباید بتواند تأییدِ پرداخت را fail کند.
 *
 * ── هزینه ────────────────────────────────────────────────────────────────
 * برای هر درخواستِ نوشتنیِ ادمین: یک کلونِ سند هنگام load (برای «قبل»)، و در
 * مسیرِ کوئری (`findOneAndUpdate` و هم‌خانواده‌ها) دو خواندنِ اضافه‌ی سبک.
 * ترافیکِ پنل کم است و بهایش یک دفترِ ممیزیِ واقعی است.
 */

import mongoose from "mongoose";

import {
  AUDIT_IGNORED_MODELS,
  AUDIT_IGNORED_PATHS,
} from "../src/lib/auditEntities.js";
import {
  PRIVATE_DOCUMENT,
  REDACTED,
  isPrivateUrlPath,
  isSecretPath,
} from "../src/lib/auditRedaction.js";
import { currentAuditScope, recordMutation } from "../src/lib/adminAuditScope.js";

/* ────────────────────────────────────────────────────────────────────────────
 * تفاوتِ مسیرمحور
 * ──────────────────────────────────────────────────────────────────────────── */

const MAX_DEPTH = 3;
const MAX_STRING = 160;
/** بیش از این تعداد فیلدِ تغییرکرده، خوانا نیست و فقط حجم است. */
const MAX_CHANGED_FIELDS = 25;

const isLeaf = (value) =>
  value === null ||
  typeof value !== "object" ||
  value instanceof Date ||
  Array.isArray(value) ||
  typeof value.toHexString === "function" ||
  (typeof Buffer !== "undefined" && Buffer.isBuffer(value));

/** شیِ تودرتو → نگاشتِ `مسیرِ نقطه‌دار → مقدار`. */
function flatten(value, prefix, out, depth = 0) {
  if (depth >= MAX_DEPTH || isLeaf(value)) {
    out[prefix] = value;
    return;
  }
  const keys = Object.keys(value);
  if (!keys.length) {
    out[prefix] = value;
    return;
  }
  for (const key of keys) {
    flatten(value[key], prefix ? `${prefix}.${key}` : key, out, depth + 1);
  }
}

function flattenDoc(doc) {
  const out = {};
  if (!doc || typeof doc !== "object") return out;
  for (const [key, value] of Object.entries(doc)) {
    if (AUDIT_IGNORED_PATHS.has(key)) continue;
    flatten(value, key, out, 1);
  }
  return out;
}

/**
 * مقدارِ قابلِ ذخیره.
 *
 * آرایه و شیِ بزرگ به یک نشانگر تبدیل می‌شوند: هدف «چه چیزی عوض شد» است، نه
 * تکثیرِ کلِ سند در دفتر. برای فیلدهای عددی/متنی/تاریخ مقدارِ واقعی می‌ماند،
 * چون دقیقاً همان چیزی است که ممیز می‌خواهد ببیند (۱۹۹ → ۱۸۹).
 */
function summarize(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toHexString === "function") return value.toHexString();
  if (Array.isArray(value)) return `[${value.length} مورد]`;
  if (typeof value === "object") return "[شیء]";
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  return value;
}

const sameValue = (a, b) => {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a?.toHexString && b?.toHexString) return a.toHexString() === b.toHexString();
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return false;
  }
};

/**
 * تفاوتِ دو سند به شکل `{ "a.b": { from, to } }` — فقط مسیرهایی که واقعاً
 * عوض شده‌اند.
 */
export function diffPaths(before, after) {
  const source = flattenDoc(before);
  const target = flattenDoc(after);

  const changes = {};
  let count = 0;
  let omitted = 0;

  for (const path of new Set([...Object.keys(source), ...Object.keys(target)])) {
    if (sameValue(source[path], target[path])) continue;

    if (count >= MAX_CHANGED_FIELDS) {
      omitted += 1;
      continue;
    }
    count += 1;

    if (isSecretPath(path)) {
      // خودِ «عوض شد» اطلاعِ مفیدی است؛ مقدارها نه.
      changes[path] = { from: REDACTED, to: REDACTED };
    } else if (isPrivateUrlPath(path)) {
      changes[path] = {
        from: source[path] ? PRIVATE_DOCUMENT : null,
        to: target[path] ? PRIVATE_DOCUMENT : null,
      };
    } else {
      changes[path] = { from: summarize(source[path]), to: summarize(target[path]) };
    }
  }

  if (omitted) changes.__omitted = { from: null, to: `${omitted} فیلدِ دیگر` };
  return count ? changes : null;
}

const isEmptyValue = (value) =>
  value === null ||
  value === undefined ||
  value === "" ||
  (Array.isArray(value) && !value.length);

/**
 * عکسِ کوچکِ یک سند در یک سمت.
 *
 * برای ایجاد، مقادیر در سمتِ `to` می‌نشینند؛ برای حذف در سمتِ `from`. حذف
 * عمداً همین اسنپ‌شات را نگه می‌دارد: بعد از پاک‌شدنِ موجودیت، این تنها چیزی
 * است که می‌گوید *چه چیزی* پاک شد.
 */
function sideSnapshot(doc, side) {
  const flat = flattenDoc(doc);
  const changes = {};
  let count = 0;
  for (const [path, value] of Object.entries(flat)) {
    if (isEmptyValue(value)) continue;
    if (count >= MAX_CHANGED_FIELDS) break;
    count += 1;

    let shown;
    if (isSecretPath(path)) shown = REDACTED;
    else if (isPrivateUrlPath(path)) shown = PRIVATE_DOCUMENT;
    else shown = summarize(value);

    changes[path] = side === "to" ? { from: null, to: shown } : { from: shown, to: null };
  }
  return count ? changes : null;
}

const creationSnapshot = (doc) => sideSnapshot(doc, "to");
const deletionSnapshot = (doc) => sideSnapshot(doc, "from");

/* ────────────────────────────────────────────────────────────────────────────
 * ابزار
 * ──────────────────────────────────────────────────────────────────────────── */

const auditable = (modelName) => !!modelName && !AUDIT_IGNORED_MODELS.has(modelName);

/** اسنپ‌شاتِ سبکِ یک سند برای نام‌گذاری و تفاوت. */
function plainOf(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === "function") {
    try {
      return doc.toObject({ depopulate: true, virtuals: false, getters: false });
    } catch {
      return null;
    }
  }
  return doc;
}

const QUERY_OPS = [
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
];

const BULK_OPS = new Set(["updateMany", "deleteMany"]);
const DELETE_OPS = new Set(["findOneAndDelete", "deleteOne", "deleteMany"]);

/* ────────────────────────────────────────────────────────────────────────────
 * پلاگین
 * ──────────────────────────────────────────────────────────────────────────── */

export default function auditPlugin(schema) {
  if (schema.$auditPluginApplied) return;
  schema.$auditPluginApplied = true;

  /* ── سندی که از دیتابیس خوانده می‌شود: عکسِ «قبل» ─────────────────────
     رایگان نیست، پس فقط وقتی گرفته می‌شود که یک درخواستِ نوشتنیِ ادمین در
     جریان باشد. بدونِ این، `save()` هیچ راهی برای دانستنِ مقدارِ قبلی ندارد
     — Mongoose آن را نگه نمی‌دارد. */
  schema.post("init", function captureBefore(doc) {
    try {
      if (!currentAuditScope()) return;
      if (!auditable(doc?.constructor?.modelName)) return;
      doc.$locals.auditBefore = plainOf(doc);
    } catch {
      /* ممیزی هرگز عملیات را نمی‌شکند */
    }
  });

  schema.pre("save", function markSave() {
    try {
      if (!currentAuditScope()) return;
      this.$locals.auditWasNew = this.isNew;
    } catch {
      /* بی‌صدا */
    }
  });

  schema.post("save", function emitSave(doc) {
    try {
      const scope = currentAuditScope();
      if (!scope) return;

      const model = doc?.constructor?.modelName;
      if (!auditable(model)) return;

      const wasNew = doc.$locals.auditWasNew === true;
      const before = doc.$locals.auditBefore || null;
      const after = plainOf(doc);

      const changes = wasNew ? creationSnapshot(after) : diffPaths(before, after);
      // ذخیره‌ی بدونِ تغییر (`save()` روی سندِ دست‌نخورده) رویداد نیست.
      if (!wasNew && !changes) return;

      recordMutation({
        model,
        op: wasNew ? "create" : "update",
        id: doc._id ? String(doc._id) : "",
        doc: after,
        changes,
        session: doc.$__?.saveOptions?.session || null,
      });

      // عکسِ «قبل» برای ذخیره‌ی بعدیِ همین سند تازه می‌شود.
      doc.$locals.auditBefore = after;
    } catch {
      /* بی‌صدا */
    }
  });

  /* ── حذفِ سندی که در دست است: doc.deleteOne() ───────────────────────── */
  schema.post("deleteOne", { document: true, query: false }, function emitDocDelete(doc) {
    try {
      const scope = currentAuditScope();
      if (!scope) return;

      const model = doc?.constructor?.modelName;
      if (!auditable(model)) return;

      const snapshot = doc.$locals.auditBefore || plainOf(doc);
      recordMutation({
        model,
        op: "delete",
        id: doc._id ? String(doc._id) : "",
        doc: snapshot,
        changes: deletionSnapshot(snapshot),
        session: null,
      });
    } catch {
      /* بی‌صدا */
    }
  });

  /* ── مسیرِ کوئری ───────────────────────────────────────────────────────
     اینجا هیچ سندی در حافظه نیست، پس «قبل» باید خوانده شود. برای عملیاتِ
     دسته‌ای عمداً خوانده نمی‌شود: یک updateMany می‌تواند هزاران سند را
     بگیرد و کشیدنِ همه‌شان به حافظه برای یک لاگ، خودش یک حادثه است. */
  for (const op of QUERY_OPS) {
    schema.pre(op, { document: false, query: true }, async function readBefore() {
      try {
        if (!currentAuditScope()) return;
        if (!auditable(this.model?.modelName)) return;
        if (BULK_OPS.has(op)) return;

        const session = this.getOptions?.().session || null;
        this._auditBefore = await this.model
          .findOne(this.getFilter())
          .session(session)
          .lean();
      } catch {
        this._auditBefore = null;
      }
    });

    schema.post(op, { document: false, query: true }, async function emitQuery(res) {
      try {
        const scope = currentAuditScope();
        if (!scope) return;

        const model = this.model?.modelName;
        if (!auditable(model)) return;

        const session = this.getOptions?.().session || null;

        if (BULK_OPS.has(op)) {
          const count = Number(res?.modifiedCount ?? res?.deletedCount ?? 0);
          if (!count) return;
          recordMutation({
            model,
            op,
            id: "",
            doc: null,
            changes: null,
            count,
            filter: this.getFilter(),
            session,
          });
          return;
        }

        const before = this._auditBefore || null;

        if (DELETE_OPS.has(op)) {
          const removed = Number(res?.deletedCount ?? (res ? 1 : 0));
          if (!removed && !before) return;
          recordMutation({
            model,
            op: "delete",
            id: before?._id ? String(before._id) : "",
            doc: before,
            changes: deletionSnapshot(before),
            session,
          });
          return;
        }

        // upsert بدونِ سندِ قبلی → ایجاد.
        const isCreate = !before;
        const after = await this.model
          .findOne(before?._id ? { _id: before._id } : this.getFilter())
          .session(session)
          .lean();

        if (!after && isCreate) return;

        const changes = isCreate ? creationSnapshot(after) : diffPaths(before, after);
        if (!changes) return;

        recordMutation({
          model,
          op: isCreate ? "create" : "update",
          id: String((after || before)?._id || ""),
          doc: after || before,
          changes,
          session,
        });
      } catch {
        /* بی‌صدا */
      }
    });
  }

  schema.post("insertMany", function emitInsertMany(docs) {
    try {
      const scope = currentAuditScope();
      if (!scope) return;

      const list = Array.isArray(docs) ? docs : [docs];
      const model = list[0]?.constructor?.modelName || this?.modelName;
      if (!auditable(model)) return;

      for (const doc of list) {
        const plain = plainOf(doc);
        recordMutation({
          model,
          op: "create",
          id: plain?._id ? String(plain._id) : "",
          doc: plain,
          changes: creationSnapshot(plain),
          session: null,
        });
      }
    } catch {
      /* بی‌صدا */
    }
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * ثبتِ سراسری
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ ترتیب حیاتی است.
 *
 * `mongoose.plugin()` فقط روی اسکیماهایی اثر دارد که *بعد از* آن کامپایل
 * شوند؛ افزودنِ هوک به مدلِ کامپایل‌شده بی‌صدا هیچ کاری نمی‌کند (تست شد).
 * چون ESM همه‌ی importها را پیش از بدنه‌ی ماژول ارزیابی می‌کند، این فراخوانی
 * باید یک *اثرِ جانبیِ خودِ همین ماژول* باشد و این ماژول اولین import در
 * models/registerModels.js. src/instrumentation.js هم آن را زودتر بار می‌کند
 * تا حتی اگر روتی مدلی را مستقیم و پیش از registerModels ایمپورت کرد، پلاگین
 * از قبل نشسته باشد.
 */
export function registerAuditPlugin() {
  if (mongoose.__auditPluginRegistered) return;
  mongoose.__auditPluginRegistered = true;
  mongoose.plugin(auditPlugin);
}

registerAuditPlugin();
