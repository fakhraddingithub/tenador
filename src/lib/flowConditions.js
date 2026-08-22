/**
 * src/lib/flowConditions.js
 *
 * نمایشِ شرطیِ مراحلِ فرایند سفارش — «این مرحله فقط وقتی دیده شود که ...».
 *
 * ماژول خالص (بدون I/O) تا هم مودالِ مشتری و هم موتورِ قیمت در سرور از یک
 * منطقِ واحد استفاده کنند. مرحله‌ی نامرئی هیچ انتخاب و هیچ قیمتی به سفارش
 * اضافه نمی‌کند — این تصمیم در سرور هم دوباره گرفته می‌شود، نه فقط در UI.
 *
 * ─── تعریف روی نود ───
 *  node.visibleWhen = {
 *    mode: "all" | "any",              // پیش‌فرض: all
 *    conditions: [{ type, nodeId, optionKey?, choiceKey? }]
 *  }
 *  نبودِ visibleWhen یا شرطِ خالی ⇒ مرحله همیشه دیده می‌شود.
 *  (پس همه‌ی فرایندهای موجود دقیقاً مثل قبل کار می‌کنند.)
 *
 * ─── افزودنِ نوعِ شرطِ جدید ───
 *  فقط یک ورودی به CONDITION_EVALUATORS اضافه کنید. هیچ جای دیگری تغییر نمی‌کند.
 */

import { isServiceFeeEntry } from "@/lib/serviceConfig";

/** آیا این انتخاب واقعاً پاسخی دارد؟ (نودِ دسته‌بندی یا خدمت) */
function hasAnswer(sel) {
  if (!sel) return false;
  if (sel.nodeType === "service") {
    // هزینه‌ی خودِ خدمت پاسخِ مشتری نیست؛ نباید یک مرحله را «انتخاب‌شده» جا بزند
    return (
      Array.isArray(sel.serviceConfig) &&
      sel.serviceConfig.some((c) => !isServiceFeeEntry(c))
    );
  }
  return Boolean(sel.selectedProductId || sel.selectedProduct);
}

/**
 * ارزیابِ هر نوعِ شرط: (condition, selections) => boolean
 * selections: { [nodeId]: selection }  — فقط انتخاب‌های مراحلِ *مرئی*
 */
export const CONDITION_EVALUATORS = {
  // کاربر در مرحله‌ی مرجع چیزی انتخاب کرده است
  answered: (c, selections) => hasAnswer(selections[c.nodeId]),

  // کاربر در مرحله‌ی مرجع چیزی انتخاب نکرده (یا آن مرحله نامرئی شده)
  notAnswered: (c, selections) => !hasAnswer(selections[c.nodeId]),

  // در یک نودِ خدمت، آپشنِ مشخصی دقیقاً یک گزینه‌ی مشخص را دارد
  choiceEquals: (c, selections) => {
    const sel = selections[c.nodeId];
    if (!sel || sel.nodeType !== "service") return false;
    return (sel.serviceConfig || []).some(
      (x) =>
        String(x.optionKey) === String(c.optionKey) &&
        String(x.choiceKey) === String(c.choiceKey)
    );
  },
};

export const CONDITION_TYPES = Object.keys(CONDITION_EVALUATORS);

/** برچسبِ فارسیِ هر نوع شرط — برای پنل ادمین */
export const CONDITION_TYPE_LABELS = {
  answered: "در این مرحله چیزی انتخاب شده باشد",
  notAnswered: "در این مرحله چیزی انتخاب نشده باشد",
  choiceEquals: "گزینه‌ی مشخصی انتخاب شده باشد",
};

/** آیا نود اصلاً شرطی دارد؟ */
export function hasConditions(node) {
  const list = node?.visibleWhen?.conditions;
  return Array.isArray(list) && list.length > 0;
}

/**
 * آیا این نود با توجه به انتخاب‌های فعلی دیده می‌شود؟
 * شرطِ با نوعِ ناشناخته نادیده گرفته می‌شود (fail-open) تا دادهٔ ناسازگارِ
 * آینده یک مرحله را بی‌صدا ناپدید نکند.
 */
export function isNodeVisible(node, selections = {}) {
  if (!hasConditions(node)) return true;

  const { mode = "all", conditions } = node.visibleWhen;
  const results = conditions
    .filter((c) => c && CONDITION_EVALUATORS[c.type])
    .map((c) => CONDITION_EVALUATORS[c.type](c, selections));

  if (results.length === 0) return true;
  return mode === "any" ? results.some(Boolean) : results.every(Boolean);
}

/**
 * مجموعه‌ی نودهای مرئی، با در نظر گرفتنِ زنجیره:
 * اگر A نامرئی شود، انتخابش حساب نمی‌شود، پس Bـی که به A وابسته است هم نامرئی می‌شود.
 *
 * یک پیمایشِ رو به جلو روی ترتیبِ مراحل کافی است، چون پنل ادمین فقط اجازه‌ی
 * ارجاع به مراحلِ *قبلی* را می‌دهد.
 *
 * @param {Object[]} orderedNodes خروجیِ buildStepSequence
 * @param {Object} selectionsByNodeId { [nodeId]: selection }
 * @returns {{ visibleNodes: Object[], visibleIds: Set<string>, effectiveSelections: Object }}
 */
export function resolveVisibleSteps(orderedNodes, selectionsByNodeId = {}) {
  const effectiveSelections = {};
  const visibleNodes = [];
  const visibleIds = new Set();

  for (const node of orderedNodes || []) {
    if (!node?.id) continue;
    if (!isNodeVisible(node, effectiveSelections)) continue;

    visibleNodes.push(node);
    visibleIds.add(node.id);
    // فقط انتخابِ مرحله‌ی مرئی به مراحلِ بعدی منتقل می‌شود
    const sel = selectionsByNodeId[node.id];
    if (sel !== undefined) effectiveSelections[node.id] = sel;
  }

  return { visibleNodes, visibleIds, effectiveSelections };
}

/** آرایه‌ی انتخاب‌ها → نقشه‌ی nodeId → selection */
export function selectionsToMap(flowSelections) {
  const map = {};
  for (const sel of Array.isArray(flowSelections) ? flowSelections : []) {
    if (sel?.nodeId != null) map[String(sel.nodeId)] = sel;
  }
  return map;
}

/**
 * فیلترِ سمتِ سرور: فقط انتخاب‌هایی که به مرحله‌ی مرئی تعلق دارند باقی می‌مانند.
 * انتخابِ مرحله‌ی نامرئی دور ریخته می‌شود تا نه در قیمت بیاید و نه در سفارش.
 *
 * @returns {{ kept: Object[], dropped: Object[] }}
 */
export function filterVisibleSelections(orderedNodes, flowSelections) {
  const list = Array.isArray(flowSelections) ? flowSelections : [];
  const { visibleIds } = resolveVisibleSteps(orderedNodes, selectionsToMap(list));

  const kept = [];
  const dropped = [];
  for (const sel of list) {
    (visibleIds.has(String(sel?.nodeId)) ? kept : dropped).push(sel);
  }
  return { kept, dropped };
}

/**
 * انتخاب‌هایی که واقعاً باید قیمت بخورند و در سفارش ثبت شوند — به ترتیبِ مراحل.
 *
 * دو قانون در یک پیمایش:
 *   • مرحله‌ی نامرئی انتخابش دور ریخته می‌شود (شرط برقرار نیست).
 *   • مرحله‌ی خدمتِ *مرئیِ* اجباری حتی اگر کلاینت نفرستدش ساخته می‌شود، تا
 *     هزینه‌ی خدمتِ اجباری با حذفِ یک ردیف از سبد دور زده نشود.
 *
 * پس «اجباری» فقط تا وقتی معنا دارد که مرحله مرئی باشد؛ خدمتِ اجباریِ پنهان
 * هرگز به سفارش اضافه نمی‌شود.
 *
 * @param {Object[]} orderedNodes خروجیِ buildStepSequence
 * @param {Object[]} flowSelections انتخاب‌های خامِ کلاینت
 */
export function resolveOrderedSelections(orderedNodes, flowSelections) {
  const selMap = selectionsToMap(flowSelections);
  const { visibleNodes } = resolveVisibleSteps(orderedNodes, selMap);

  return visibleNodes
    .map(
      (node) =>
        selMap[node.id] ||
        (node.type === "service" && node.required
          ? { nodeId: node.id, nodeType: "service", serviceConfig: [] }
          : null)
    )
    .filter(Boolean);
}

/**
 * اعتبارسنجیِ تعریفِ شرط‌ها هنگامِ ذخیره در پنل ادمین.
 * @param {Object[]} nodes نودها به ترتیبِ آرایه (همان ترتیبِ مراحل)
 * @returns {string[]} پیام‌های خطا
 */
export function validateNodeConditions(nodes) {
  const errors = [];
  const list = Array.isArray(nodes) ? nodes : [];
  const seenIds = new Set();

  for (const node of list) {
    const name = node?.label || node?.id || "مرحله";

    if (hasConditions(node)) {
      const { mode = "all", conditions } = node.visibleWhen;
      if (!["all", "any"].includes(mode)) {
        errors.push(`${name}: حالتِ ترکیبِ شرط‌ها نامعتبر است`);
      }
      conditions.forEach((c, i) => {
        if (!c?.type || !CONDITION_EVALUATORS[c.type]) {
          errors.push(`${name}: نوعِ شرطِ ${i + 1} نامعتبر است`);
          return;
        }
        if (!c.nodeId) {
          errors.push(`${name}: شرطِ ${i + 1} به هیچ مرحله‌ای اشاره نمی‌کند`);
          return;
        }
        if (String(c.nodeId) === String(node.id)) {
          errors.push(`${name}: یک مرحله نمی‌تواند به خودش وابسته باشد`);
          return;
        }
        // فقط ارجاع به مراحلِ قبلی — جلوگیری از وابستگیِ حلقوی
        if (!seenIds.has(String(c.nodeId))) {
          errors.push(`${name}: شرطِ ${i + 1} باید به یکی از مراحلِ قبلی اشاره کند`);
          return;
        }
        if (c.type === "choiceEquals" && (!c.optionKey || !c.choiceKey)) {
          errors.push(`${name}: برای شرطِ ${i + 1} باید آپشن و گزینه مشخص شود`);
        }
      });
    }

    if (node?.id) seenIds.add(String(node.id));
  }

  return errors;
}
