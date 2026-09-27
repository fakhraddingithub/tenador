/**
 * قالب‌بندیِ درون‌خطیِ ویرایشگرِ متنِ غنی (مقاله و مینی‌مقاله) — عملیاتِ DOM، بدونِ React.
 *
 * یک پیاده‌سازی برای *هر* ویژگیِ درون‌خطی: `font-size` و `line-height` از همین
 * مسیر می‌آیند. پیش‌تر همه‌ی این منطق روی «اندازه» سیم‌کشی شده بود؛ تکرارش برای
 * ارتفاعِ خط یعنی دو نسخه که روزی از هم دور می‌افتند — و بدتر، عملیاتِ هر کدام
 * ویژگیِ دیگری را پاک می‌کرد.
 *
 * قواعد:
 *  - مقدار همیشه روی یک <span style="<prop>:<value>"> می‌نشیند؛ مقدارهای
 *    تودرتوی *همان ویژگی* داخلِ انتخاب برداشته می‌شوند تا انتخابِ دوباره واقعاً
 *    اثر کند. ویژگی‌های دیگر (اندازه، رنگ) دست نمی‌خورند.
 *  - «پیش‌فرض» متن را از هر spanِ دارای آن ویژگی در بیرون هم بیرون می‌کشد (والد
 *    را دو تکه می‌کند)؛ فقط پاک‌کردنِ مقدارهای درونی کافی نیست چون متن ارث می‌برد.
 *  - بدونِ انتخاب (فقط مکان‌نما) مقدار برای متنی که بعد تایپ می‌شود اعمال
 *    می‌شود، مثلِ Word — با یک spanِ حاویِ فاصله‌ی صفرعرض که در خروجی حذف می‌شود.
 *  - پس از هر تغییر، spanهای خالی و spanهای بی‌ویژگی جمع می‌شوند تا نشانه‌گذاری انباشته نشود.
 */

export const ZWSP = "​";

/** ویژگی‌هایی که ویرایشگر روی span می‌گذارد — هر دو در پاک‌سازیِ سرور هم مجازند. */
export const INLINE_STYLE_PROPS = ["font-size", "line-height"];

const valueOf = (node, prop) => (node?.nodeType === 1 ? node.style?.getPropertyValue(prop) || "" : "");
const hasStyle = (node, prop) => Boolean(valueOf(node, prop));

/** نزدیک‌ترین نیای دارای این ویژگی (خودِ node هم حساب می‌شود) داخلِ root. */
export function styledAncestor(node, root, prop) {
  let current = node?.nodeType === 1 ? node : node?.parentNode;
  while (current && current !== root) {
    if (hasStyle(current, prop)) return current;
    current = current.parentNode;
  }
  return null;
}

/**
 * مقدارِ ویژگی برای انتخابِ فعلی، برای نمایش در نوارِ ابزار:
 * "18px" / "1.5" / "" (پیش‌فرضِ بلوک) / null (انتخابِ چندمقداری).
 */
export function readSelectionStyle(range, root, prop) {
  const at = (node) => styledAncestor(node, root, prop)?.style.getPropertyValue(prop) || "";
  const start = at(range.startContainer);
  if (range.collapsed) return start;
  if (at(range.endContainer) !== start) return null;
  // spanی که کاملاً داخلِ انتخاب است هم انتخاب را چندمقداری می‌کند.
  const container = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
  for (const element of container.querySelectorAll(`[style*='${prop}']`)) {
    if (range.intersectsNode(element) && valueOf(element, prop) !== start && element.textContent.replaceAll(ZWSP, "")) return null;
  }
  return start;
}

function unwrap(element) {
  const parent = element.parentNode;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  element.remove();
}

/** spanهای خالی و spanهای بدونِ ویژگی را جمع می‌کند. `keep` دست نمی‌خورد. */
export function tidy(root, keep = null) {
  // extractContents روی انتخابی درونِ یک گره‌ی متنی، گره‌ی متنیِ خالی به‌جا می‌گذارد.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const empties = [];
  while (walker.nextNode()) if (!walker.currentNode.data) empties.push(walker.currentNode);
  for (const text of empties) text.remove();
  // مقدارِ بیرونی‌ای که تنها فرزندش خودش همان ویژگی را دارد هرگز اعمال نمی‌شود؛
  // حذفش می‌کنیم تا ویرایش‌های پیاپی spanهای مرده روی هم انباشته نکنند. بقیه‌ی
  // استایلِ آن (اندازه، رنگ، ارتفاعِ خط) دست نمی‌خورد — هر ویژگی جدا بررسی می‌شود.
  for (const prop of INLINE_STYLE_PROPS) {
    for (const element of [...root.querySelectorAll(`[style*='${prop}']`)]) {
      const only = element.childNodes.length === 1 ? element.firstChild : null;
      if (element !== keep && hasStyle(only, prop)) element.style.removeProperty(prop);
    }
  }
  for (const element of [...root.querySelectorAll("[style]")]) {
    if (!element.getAttribute("style")?.trim()) element.removeAttribute("style");
  }
  for (const span of [...root.querySelectorAll("span")].reverse()) {
    if (span === keep) continue;
    if (!span.firstChild) span.remove();
    else if (!span.attributes.length) unwrap(span);
  }
}

/** node را از همه‌ی نیاکانِ دارای این ویژگی بیرون می‌کشد؛ هر نیا دو تکه می‌شود. */
function liftOutOfStyledAncestors(node, root, prop) {
  for (let ancestor = styledAncestor(node.parentNode, root, prop); ancestor; ancestor = styledAncestor(node.parentNode, root, prop)) {
    const before = ancestor.cloneNode(false);
    const after = ancestor.cloneNode(false);
    const head = document.createRange();
    head.setStart(ancestor, 0);
    head.setEndBefore(node);
    before.append(head.extractContents());
    const tail = document.createRange();
    tail.setStartAfter(node);
    tail.setEnd(ancestor, ancestor.childNodes.length);
    after.append(tail.extractContents());
    ancestor.before(before);
    ancestor.after(after);
    // حالا این نیا فقط مسیرِ رسیدن به node را در بر دارد. فقط *همین* ویژگی
    // برداشته می‌شود: اندازه‌ی متن با «ارتفاعِ خطِ پیش‌فرض» از بین نمی‌رود.
    ancestor.style.removeProperty(prop);
  }
}

/**
 * مقدار را روی range اعمال می‌کند. `value` رشته‌ی CSS ("18px"، "1.5") یا null
 * برای «پیش‌فرض». محدوده‌ای را برمی‌گرداند که باید پس از عمل انتخاب شود (یا null).
 */
export function applyInlineStyle(root, range, prop, value) {
  if (!range || !root.contains(range.commonAncestorContainer)) return null;

  if (range.collapsed) {
    if (!value) return null;
    const span = document.createElement("span");
    span.style.setProperty(prop, value);
    span.textContent = ZWSP;
    range.insertNode(span);
    tidy(root, span);
    const caret = document.createRange();
    caret.setStart(span.firstChild, 1);
    caret.collapse(true);
    return caret;
  }

  const span = document.createElement("span");
  span.append(range.extractContents());
  for (const nested of span.querySelectorAll(`[style*='${prop}']`)) nested.style.removeProperty(prop);
  range.insertNode(span);
  if (value) span.style.setProperty(prop, value);
  else liftOutOfStyledAncestors(span, root, prop);

  // گره‌های مرزی پیش از tidy گرفته می‌شوند (spanِ بی‌مقدار باز می‌شود ولی
  // فرزندانش همان گره‌ها می‌مانند)؛ فقط گره‌های دارای محتوا، چون tidy
  // گره‌های متنیِ خالی و spanهای خالی را برمی‌دارد.
  const meaningful = [...span.childNodes].filter((node) => node.nodeName === "BR" || node.textContent.replaceAll(ZWSP, ""));
  tidy(root, value ? span : null);
  const selection = document.createRange();
  if (value) {
    selection.selectNodeContents(span);
    return selection;
  }
  if (!meaningful.length || !meaningful[0].parentNode) return null;
  selection.setStartBefore(meaningful[0]);
  selection.setEndAfter(meaningful.at(-1));
  return selection;
}

/**
 * خروجیِ ذخیره‌شدنی: فاصله‌ی صفرعرضِ مکان‌نما و spanهای خالی حذف می‌شوند.
 * خودِ DOMِ ویرایشگر دست نمی‌خورد (مکان‌نما سرِ جایش می‌ماند).
 */
export function serializeEditor(root) {
  const clone = root.cloneNode(true);
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  for (const text of texts) {
    if (text.data.includes(ZWSP)) text.data = text.data.replaceAll(ZWSP, "");
    if (!text.data) text.remove();
  }
  tidy(clone);
  return { html: clone.innerHTML, text: root.innerText.replaceAll(ZWSP, "") };
}
