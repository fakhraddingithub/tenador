/**
 * src/lib/adminAuditFlush.js
 *
 * پایانِ یک درخواستِ ادمین: تبدیلِ رویدادهای خامِ نوشتن به *یک* رکوردِ خوانا.
 *
 * ── چرا یک رکورد و نه یکی به‌ازای هر نوشتن ───────────────────────────────
 * «تأیید پرداخت» از نظر ادمین یک اقدام است، ولی از نظر دیتابیس دو نوشتن
 * (Payment و Order) و گاهی بیشتر. اگر هر نوشتن یک ردیف شود، خطِ زمانی سه
 * برابر می‌شود و خواندنش سخت‌تر از همان «اقدامِ نوشتنیِ مجاز»ِ قبلی. پس
 * مهم‌ترین موجودیت (بالاترین priority در رجیستری) موضوعِ رکورد می‌شود و
 * بقیه در `related` می‌نشینند — که اتفاقاً همان «سفارش/محصول/پرداختِ مرتبط»
 * است که ممیز می‌خواهد ببیند.
 *
 * ── وقتی هیچ نوشتنی رخ نداده ────────────────────────────────────────────
 * درخواستی که گیت از آن عبور کرده ولی چیزی در دیتابیس عوض نکرده (اعتبارسنجی
 * رد کرد، یا مقدارِ جدید با قبلی یکی بود) همان رکوردِ قدیمیِ
 * `authz.granted / attempted` را می‌گیرد. معنای آن رکورد عوض نشده است، پس
 * رکوردهای قدیمی هم همچنان درست خوانده می‌شوند.
 */

import { recordAdminActivity } from "./adminActivity.js";
import { committedEvents } from "./adminAuditScope.js";
import { describeBulk, describeMutation, entityDescriptor, entityName } from "./auditEntities.js";

/** بیش از این تعداد موجودیتِ مرتبط، دیگر کمکی به فهم نمی‌کند. */
const MAX_RELATED = 12;

/** رویدادها را نام‌دار می‌کند؛ پاسِ دوم تا Payment بتواند نامِ Order را ببیند. */
function nameEvents(events) {
  const named = events.map((event) => ({
    ...event,
    name: entityName(event.model, event.doc, null),
  }));
  for (const event of named) {
    event.name = entityName(event.model, event.doc, named);
  }
  return named;
}

function describeEvent(event) {
  if (event.op === "updateMany" || event.op === "deleteMany") {
    return describeBulk({ model: event.model, op: event.op, count: event.count || 0 });
  }
  return describeMutation({
    model: event.model,
    op: event.op,
    name: event.name,
    changes: event.changes,
  });
}

/**
 * ساختِ بدنه‌ی رکورد از روی دامنه — بدونِ نوشتن.
 *
 * جدا نگه داشته شده تا تست بتواند بدونِ دیتابیس بسنجدش.
 */
export function buildActivityFromScope(scope) {
  const events = nameEvents(committedEvents(scope));
  if (!events.length) return null;

  // موضوعِ اصلی: مهم‌ترین موجودیت. مساوی → اولین نوشتن.
  const primary = events.reduce((best, event) =>
    entityDescriptor(event.model).priority > entityDescriptor(best.model).priority ? event : best
  );

  const { action, description } = describeEvent(primary);

  const related = events
    .filter((event) => event !== primary)
    .slice(0, MAX_RELATED)
    .map((event) => {
      const described = describeEvent(event);
      return {
        type: event.model,
        key: entityDescriptor(event.model).key,
        id: event.id || "",
        label: event.name || "",
        op: event.op,
        action: described.action,
        description: described.description,
        changes: event.changes || null,
        count: event.count || undefined,
      };
    });

  const extra = events.length - 1 - related.length;

  return {
    action,
    description,
    resource: { type: primary.model, id: primary.id, label: primary.name },
    changes: primary.changes || null,
    related,
    metadata: {
      mutations: events.length,
      ...(extra > 0 ? { relatedOmitted: extra } : {}),
      ...(scope.dropped ? { droppedEvents: scope.dropped } : {}),
      ...(primary.count ? { affected: primary.count } : {}),
    },
  };
}

/**
 * نوشتنِ رکوردِ پایانِ درخواست. هرگز throw نمی‌کند.
 *
 * از `after()` صدا زده می‌شود، یعنی بعد از ارسالِ پاسخ — پس هیچ میلی‌ثانیه‌ای
 * به عملیاتِ کاربر اضافه نمی‌کند.
 */
export async function flushAuditScope(scope) {
  try {
    if (!scope || scope.flushed) return false;
    scope.flushed = true;

    // روتی که خودش رکوردِ دقیق نوشته است (auditor) دوباره ثبت نمی‌شود.
    if (scope.handled) return false;

    const built = buildActivityFromScope(scope);

    if (!built) {
      // هیچ نوشتنی رخ نداد — همان رکوردِ «مجاز شد»ِ فاز ۶.
      if (!scope.permissions.length) return false;
      return await recordAdminActivity({
        ctx: scope.ctx,
        action: "authz.granted",
        permissions: scope.permissions,
        result: "attempted",
        statusCode: 200,
      });
    }

    return await recordAdminActivity({
      ctx: scope.ctx,
      permissions: scope.permissions,
      result: "success",
      statusCode: 200,
      ...built,
    });
  } catch (error) {
    console.error("[adminAudit] flush نشد:", error?.message || error);
    return false;
  }
}
