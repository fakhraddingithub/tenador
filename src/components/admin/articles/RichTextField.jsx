"use client";

import { useEffect, useRef, useState } from "react";
import { FiAlignCenter, FiAlignLeft, FiAlignRight, FiBold, FiItalic, FiLink, FiType, FiUnderline, FiX } from "react-icons/fi";
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

  const refreshMarks = () => setMarks({
    bold: document.queryCommandState("bold"),
    italic: document.queryCommandState("italic"),
    underline: document.queryCommandState("underline"),
  });

  const insideEditor = () => {
    const selection = window.getSelection();
    return selection?.rangeCount ? ref.current?.contains(selection.getRangeAt(0).commonAncestorContainer) : false;
  };

  const exec = (command, argument) => {
    if (!insideEditor()) ref.current?.focus();
    // styleWithCSS باعث می‌شود رنگ به‌جای <font> قدیمی، span با style بدهد —
    // همان چیزی که واژگانِ پاک‌سازی می‌پذیرد.
    document.execCommand("styleWithCSS", false, true);
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

  const openLink = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed || !insideEditor()) return;
    savedRange.current = selection.getRangeAt(0).cloneRange();
    setLinkUrl("");
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    setLinkOpen(false);
    if (!url || !savedRange.current) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange.current);
    exec(url === "-" ? "unlink" : "createLink", url === "-" ? undefined : url);
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

      <ToolButton title="پیوند روی متن انتخاب‌شده" onClick={openLink}><FiLink /></ToolButton>
      {linkOpen ? <span className="flex items-center gap-1">
        <input
          autoFocus
          dir="ltr"
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } if (event.key === "Escape") setLinkOpen(false); }}
          placeholder="https://…"
          className="w-44 border bg-white px-2 py-1 text-[11px] outline-none"
          style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}
        />
        <ToolButton title="ثبت پیوند" onClick={applyLink}><FiLink /></ToolButton>
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
      className={`w-full px-3 py-2.5 text-sm leading-8 outline-none focus:bg-white ${singleLine ? "" : "min-h-24"}`}
    />
  </div>;
}
