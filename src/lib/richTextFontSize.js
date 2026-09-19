/**
 * اندازه‌ی متن در ویرایشگرِ متنِ غنی (مقاله و مینی‌مقاله) — عملیاتِ DOM، بدونِ React.
 *
 * قواعد:
 *  - اندازه همیشه روی یک <span style="font-size:Npx"> می‌نشیند؛ اندازه‌های
 *    تودرتوی داخلِ انتخاب برداشته می‌شوند تا انتخابِ دوباره واقعاً اثر کند.
 *  - «پیش‌فرض» متن را از هر spanِ اندازه‌دارِ بیرونی هم بیرون می‌کشد (والد را دو
 *    تکه می‌کند)؛ فقط پاک‌کردنِ اندازه‌های درونی کافی نبود چون متن از والد ارث می‌برد.
 *  - بدونِ انتخاب (فقط مکان‌نما) اندازه برای متنی که بعد تایپ می‌شود اعمال
 *    می‌شود، مثلِ Word — با یک spanِ حاویِ فاصله‌ی صفرعرض که در خروجی حذف می‌شود.
 *  - پس از هر تغییر، spanهای خالی و spanهای بی‌ویژگی جمع می‌شوند تا نشانه‌گذاری انباشته نشود.
 */

export const ZWSP = "​";

const hasSize = (node) => node?.nodeType === 1 && Boolean(node.style?.fontSize);

/** نزدیک‌ترین نیای اندازه‌دار (خودِ node هم حساب می‌شود) داخلِ root. */
export function sizedAncestor(node, root) {
  let current = node?.nodeType === 1 ? node : node?.parentNode;
  while (current && current !== root) {
    if (hasSize(current)) return current;
    current = current.parentNode;
  }
  return null;
}

/**
 * اندازه‌ی انتخابِ فعلی برای نمایش در نوارِ ابزار:
 * "18px" / اندازه‌ی قدیمی مثلِ "1.25em" / "" (پیش‌فرضِ بلوک) / null (انتخابِ چنداندازه‌ای).
 */
export function readSelectionSize(range, root) {
  const sizeAt = (node) => sizedAncestor(node, root)?.style.fontSize || "";
  const start = sizeAt(range.startContainer);
  if (range.collapsed) return start;
  if (sizeAt(range.endContainer) !== start) return null;
  // spanِ اندازه‌داری که کاملاً داخلِ انتخاب است هم انتخاب را چنداندازه‌ای می‌کند.
  const container = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
  for (const element of container.querySelectorAll("[style*='font-size']")) {
    if (range.intersectsNode(element) && element.style.fontSize !== start && element.textContent.replaceAll(ZWSP, "")) return null;
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
  // اندازه‌ی بیرونی‌ای که تنها فرزندش خودش اندازه دارد هرگز اعمال نمی‌شود؛ حذفش
  // می‌کنیم تا ویرایش‌های پیاپی spanهای مرده روی هم انباشته نکنند. بقیه‌ی
  // استایلِ آن (مثلاً رنگ) دست نمی‌خورد.
  for (const element of [...root.querySelectorAll("[style*='font-size']")]) {
    const only = element.childNodes.length === 1 ? element.firstChild : null;
    if (element !== keep && hasSize(only)) element.style.removeProperty("font-size");
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

/** node را از همه‌ی نیاکانِ اندازه‌دار بیرون می‌کشد؛ هر نیا دو تکه می‌شود. */
function liftOutOfSizedAncestors(node, root) {
  for (let ancestor = sizedAncestor(node.parentNode, root); ancestor; ancestor = sizedAncestor(node.parentNode, root)) {
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
    // حالا این نیا فقط مسیرِ رسیدن به node را در بر دارد.
    ancestor.style.removeProperty("font-size");
  }
}

/**
 * اندازه را روی range اعمال می‌کند. px: عددِ صحیح، یا null برای «پیش‌فرض».
 * محدوده‌ای را برمی‌گرداند که باید پس از عمل انتخاب شود (یا null اگر کاری نشد).
 */
export function applyFontSize(root, range, px) {
  if (!range || !root.contains(range.commonAncestorContainer)) return null;

  if (range.collapsed) {
    if (!px) return null;
    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;
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
  for (const nested of span.querySelectorAll("[style*='font-size']")) nested.style.removeProperty("font-size");
  range.insertNode(span);
  if (px) span.style.fontSize = `${px}px`;
  else liftOutOfSizedAncestors(span, root);

  // گره‌های مرزی پیش از tidy گرفته می‌شوند (spanِ بی‌اندازه باز می‌شود ولی
  // فرزندانش همان گره‌ها می‌مانند)؛ فقط گره‌های دارای محتوا، چون tidy
  // گره‌های متنیِ خالی و spanهای خالی را برمی‌دارد.
  const meaningful = [...span.childNodes].filter((node) => node.nodeName === "BR" || node.textContent.replaceAll(ZWSP, ""));
  tidy(root, px ? span : null);
  const selection = document.createRange();
  if (px) {
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
