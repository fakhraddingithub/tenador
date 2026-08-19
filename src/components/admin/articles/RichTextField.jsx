"use client";

import { useEffect, useRef, useState } from "react";
import { FiAlignCenter, FiAlignLeft, FiAlignRight, FiBold, FiCheck, FiItalic, FiLink, FiSlash, FiType, FiUnderline, FiX } from "react-icons/fi";
import { RICH_TEXT_FONT_SIZES } from "@/lib/sanitizeRichText";

/**
 * ویرایشگرِ کوچکِ متنِ غنی برای بلوک‌های متنی.
 *
 * دو مقدار بیرون می‌دهد: `text` (متنِ ساده، همان چیزی که تا امروز ذخیره می‌شد و
 * فهرستِ مطالب و شمارشِ کلمات رویش حساب می‌کنند) و `html` (نسخه‌ی قالب‌بندی‌شده).
 * پاک‌سازیِ واقعی سمتِ سرور انجام می‌شود؛ اینجا فقط چسباندن به متنِ ساده محدود
 * می‌شود تا نشانه‌گذاریِ ناخواسته اصلاً وارد ویرایشگر نشود.
 */

const FONT_SIZE_LABELS = ["خیلی کوچک", "کوچک", "عادی", "بزرگ", "خیلی بزرگ"];
const ALIGNS = [["right", FiAlignRight, "راست‌چین"], ["center", FiAlignCenter, "وسط‌چین"], ["left", FiAlignLeft, "چپ‌چین"]];

// نشانیِ نامعتبر یا با پروتکلِ خطرناک (javascript:, data:) هرگز اعمال نمی‌شود.
// هم‌تراز با safeArticleUrl سمتِ سرور: مسیرِ نسبی مجاز است، «//» نه. پاک‌سازیِ
// سرور همین را دوباره چک می‌کند؛ این یکی فقط بازخوردِ فوری به کاربر می‌دهد.
const LINK_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

function safeLink(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return value.startsWith("//") ? "" : value;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    return LINK_SCHEMES.includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

const escapeHtml = (value) => String(value ?? "")
  .replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char])
  .replace(/\r?\n/g, "<br>");

function ToolButton({ title, active, onClick, children }) {
  return <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={Boolean(active)}
    // بدونِ این، کلیک روی دکمه فوکوس را از ویرایشگر می‌گیرد و انتخابِ کاربر
    // پیش از اجرای فرمان از بین می‌رود.
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className={`flex h-7 w-7 items-center justify-center text-xs transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${active ? "bg-[var(--color-primary)] text-white" : "text-gray-500 hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"}`}
    style={{ borderRadius: "var(--admin-radius)" }}
  >{children}</button>;
}

export default function RichTextField({ value, onChange, align, onAlign, singleLine = false }) {
  const ref = useRef(null);
  const savedRange = useRef(null);
  const [marks, setMarks] = useState({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkInvalid, setLinkInvalid] = useState(false);

  // همگام‌سازی فقط وقتی ویرایشگر فوکوس ندارد: حینِ تایپ، React نباید به محتوای
  // contentEditable دست بزند (مکان‌نما می‌پرد)، ولی بازیابیِ یک نسخه‌ی قدیمی یا
  // بارگذاریِ اولیه باید دیده شود.
  useEffect(() => {
    const element = ref.current;
    if (!element || element === document.activeElement) return;
    const incoming = value?.html || escapeHtml(value?.text || "");
    if (element.innerHTML !== incoming) element.innerHTML = incoming;
  }, [value?.html, value?.text]);

  const emit = () => {
    const element = ref.current;
    if (element) onChange({ text: element.innerText, html: element.innerHTML });
  };

  const insideEditor = () => {
    const selection = window.getSelection();
    return selection?.rangeCount ? ref.current?.contains(selection.getRangeAt(0).commonAncestorContainer) : false;
  };

  // پیوندی که انتخاب داخلِ آن است (اگر باشد) — پایه‌ی ویرایش و حذفِ پیوند.
  const currentLink = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !insideEditor()) return null;
    let node = selection.getRangeAt(0).commonAncestorContainer;
    while (node && node !== ref.current) {
      if (node.nodeName === "A") return node;
      node = node.parentNode;
    }
    return null;
  };

  const refreshMarks = () => setMarks({
    bold: document.queryCommandState("bold"),
    italic: document.queryCommandState("italic"),
    underline: document.queryCommandState("underline"),
    link: Boolean(currentLink()),
  });

  const exec = (command, argument) => {
    if (!insideEditor()) ref.current?.focus();
    // فقط برای رنگ: styleWithCSS باعث می‌شود به‌جای <font> قدیمی، span با style
    // بدهد — همان چیزی که واژگانِ پاک‌سازی می‌پذیرد.
    //
    // برای پررنگ/کج/زیرخط باید خاموش باشد، وگرنه مرورگر
    // <span style="font-weight:bold"> می‌سازد و چون font-weight در واژگانِ مجاز
    // نیست، پاک‌سازی استایل را می‌اندازد، span بی‌اثر می‌ماند و richTextValue آن
    // را «بدونِ قالب‌بندی» می‌شمارد — یعنی data.html اصلاً ذخیره نمی‌شد.
    // با خاموش بودن، خروجی <b>/<i>/<u> است که هم مجاز است هم معنایی.
    document.execCommand("styleWithCSS", false, command === "foreColor");
    document.execCommand(command, false, argument);
    emit();
    refreshMarks();
  };

  // execCommand("fontSize") فقط ۱ تا ۷ می‌پذیرد و <font size> می‌سازد، پس
  // اندازه دستی روی محدوده‌ی انتخاب‌شده گذاشته می‌شود.
  const applyFontSize = (size) => {
    const selection = window.getSelection();
    if (!size || !selection?.rangeCount || selection.isCollapsed || !insideEditor()) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    span.style.fontSize = size;
    span.appendChild(range.extractContents());
    // اندازه‌های تودرتو باعث می‌شدند تغییرِ دوباره اثر نکند.
    for (const nested of span.querySelectorAll("[style*='font-size']")) nested.style.removeProperty("font-size");
    range.insertNode(span);
    const next = document.createRange();
    next.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(next);
    emit();
  };

  // فوکوس پیش از بازگرداندن محدوده: execCommand روی عنصرِ فوکوس‌دار اثر می‌کند و
  // در این لحظه فوکوس روی کادرِ نشانی است، نه ویرایشگر.
  const restoreRange = () => {
    if (!savedRange.current) return false;
    ref.current?.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange.current);
    return true;
  };

  const openLink = () => {
    const anchor = currentLink();
    const selection = window.getSelection();
    if (anchor) {
      // روی پیوندِ موجود، انتخاب به کلِ آن گسترش می‌یابد تا تغییرِ نشانی یا حذف
      // نیمه‌کاره روی بخشی از متنِ پیوند انجام نشود.
      const range = document.createRange();
      range.selectNodeContents(anchor);
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (!selection?.rangeCount || selection.isCollapsed || !insideEditor()) return;
    savedRange.current = selection.getRangeAt(0).cloneRange();
    setLinkUrl(anchor?.getAttribute("href") || "");
    setLinkInvalid(false);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = safeLink(linkUrl);
    if (!url) return setLinkInvalid(true);
    setLinkOpen(false);
    if (restoreRange()) exec("createLink", url);
  };

  const removeLink = () => {
    setLinkOpen(false);
    if (restoreRange()) exec("unlink");
  };

  return <div className="border" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
    <div className="flex flex-wrap items-center gap-1 border-b bg-gray-50 p-1.5" style={{ borderColor: "var(--admin-border)" }}>
      <ToolButton title="پررنگ" active={marks.bold} onClick={() => exec("bold")}><FiBold /></ToolButton>
      <ToolButton title="کج" active={marks.italic} onClick={() => exec("italic")}><FiItalic /></ToolButton>
      <ToolButton title="زیرخط" active={marks.underline} onClick={() => exec("underline")}><FiUnderline /></ToolButton>

      <span className="mx-1 h-5 w-px bg-gray-200" />
      {ALIGNS.map(([key, Icon, label]) => <ToolButton key={key} title={label} active={align === key} onClick={() => onAlign(align === key ? undefined : key)}><Icon /></ToolButton>)}

      <span className="mx-1 h-5 w-px bg-gray-200" />
      <label className="flex items-center gap-1 text-gray-500" title="اندازه متن انتخاب‌شده">
        <FiType aria-hidden="true" />
        <select
          aria-label="اندازه متن انتخاب‌شده"
          value=""
          onMouseDown={(event) => { savedRange.current = window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0).cloneRange() : null; event.stopPropagation(); }}
          onChange={(event) => {
            const size = event.target.value;
            event.target.value = "";
            if (savedRange.current) {
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(savedRange.current);
            }
            applyFontSize(size);
          }}
          className="bg-transparent text-[11px] outline-none"
        >
          <option value="">اندازه</option>
          {RICH_TEXT_FONT_SIZES.map((size, index) => <option key={size} value={size}>{FONT_SIZE_LABELS[index]}</option>)}
        </select>
      </label>

      <label className="flex items-center gap-1" title="رنگ متن انتخاب‌شده">
        <input
          type="color"
          aria-label="رنگ متن انتخاب‌شده"
          defaultValue="#aa4725"
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => exec("foreColor", event.target.value)}
          className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
        />
      </label>

      <ToolButton title={marks.link ? "ویرایش پیوند" : "پیوند روی متن انتخاب‌شده"} active={marks.link} onClick={openLink}><FiLink /></ToolButton>
      {linkOpen ? <span className="flex items-center gap-1">
        <input
          autoFocus
          dir="ltr"
          value={linkUrl}
          onChange={(event) => { setLinkUrl(event.target.value); setLinkInvalid(false); }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } if (event.key === "Escape") setLinkOpen(false); }}
          placeholder="https://…"
          aria-label="نشانی پیوند"
          aria-invalid={linkInvalid || undefined}
          className="w-44 border bg-white px-2 py-1 text-[11px] outline-none"
          style={{ borderColor: linkInvalid ? "var(--admin-danger)" : "var(--admin-border)", borderRadius: "var(--admin-radius)" }}
        />
        <ToolButton title="ثبت پیوند" onClick={applyLink}><FiCheck /></ToolButton>
        {/* حذفِ پیوند فقط وقتی معنا دارد که انتخاب واقعاً داخلِ یک پیوند باشد. */}
        {marks.link ? <ToolButton title="حذف پیوند" onClick={removeLink}><FiSlash /></ToolButton> : null}
        <ToolButton title="انصراف" onClick={() => setLinkOpen(false)}><FiX /></ToolButton>
      </span> : null}
    </div>

    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={!singleLine}
      dir="rtl"
      onInput={emit}
      onBlur={emit}
      onKeyUp={refreshMarks}
      onMouseUp={refreshMarks}
      onFocus={refreshMarks}
      onKeyDown={(event) => { if (singleLine && event.key === "Enter") event.preventDefault(); }}
      // چسباندن همیشه متنِ ساده است: نشانه‌گذاریِ واژه‌پرداز یا صفحه‌ی وب هرگز
      // وارد بلوک نمی‌شود و کاربر همان چیزی را می‌بیند که ذخیره خواهد شد.
      onPaste={(event) => {
        event.preventDefault();
        const plain = event.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, singleLine ? plain.replace(/\s*\r?\n\s*/g, " ") : plain);
      }}
      // چینش سطحِ بلوک است و در style بلوک ذخیره می‌شود، ولی باید همین‌جا هم
      // دیده شود؛ وگرنه دکمه‌های چینش هیچ اثری در ویرایشگر نشان نمی‌دهند و
      // کاربر فکر می‌کند کار نمی‌کنند (خروجیِ عمومی از قبل درست بود).
      style={align ? { textAlign: align } : undefined}
      className={`w-full px-3 py-2.5 text-sm leading-8 outline-none focus:bg-white ${singleLine ? "" : "min-h-24"}`}
    />
  </div>;
}
