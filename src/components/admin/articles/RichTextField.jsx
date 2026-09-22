"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FiAlignCenter, FiAlignLeft, FiAlignRight, FiBold, FiCheck, FiChevronDown, FiItalic, FiLink, FiSlash, FiType, FiUnderline, FiX } from "react-icons/fi";
import { RICH_TEXT_PX_RANGE, RICH_TEXT_PX_SIZES, normalizeFontSizePx } from "@/lib/sanitizeRichText";
import { applyFontSize, readSelectionSize, serializeEditor } from "@/lib/richTextFontSize";

/**
 * ویرایشگرِ کوچکِ متنِ غنی برای بلوک‌های متنی.
 *
 * دو مقدار بیرون می‌دهد: `text` (متنِ ساده، همان چیزی که تا امروز ذخیره می‌شد و
 * فهرستِ مطالب و شمارشِ کلمات رویش حساب می‌کنند) و `html` (نسخه‌ی قالب‌بندی‌شده).
 * پاک‌سازیِ واقعی سمتِ سرور انجام می‌شود؛ اینجا فقط چسباندن به متنِ ساده محدود
 * می‌شود تا نشانه‌گذاریِ ناخواسته اصلاً وارد ویرایشگر نشود.
 */

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

/**
 * اندازه‌ی متن به پیکسل، مثلِ Word: کادرِ عددی (تایپِ دلخواه، اعمال با Enter یا
 * Tab) + فهرستِ پیش‌فرض‌ها. `current` اندازه‌ی انتخابِ فعلی است: "18px"، اندازه‌ی
 * قدیمیِ em، "" (پیش‌فرضِ بلوک) یا null (چند اندازه).
 */
function FontSizeControl({ current, onApply }) {
  const [draft, setDraft] = useState(null);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const listId = useId();
  const shown = draft ?? (current ? current.replace(/px$/, "") : "");
  const invalid = draft !== null && draft.trim() !== "" && normalizeFontSizePx(draft) === null;

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!box.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const commit = () => {
    const px = normalizeFontSizePx(draft);
    if (px) onApply(px);
    if (px || !draft?.trim()) setDraft(null);
  };
  const choose = (px) => { setOpen(false); setDraft(null); onApply(px); };

  return <div ref={box} className="relative flex items-center gap-1 text-gray-500" title="اندازه متن (پیکسل)">
    <FiType aria-hidden="true" />
    <div className="flex items-center border bg-white" style={{ borderColor: invalid ? "var(--admin-danger)" : "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
      <input
        role="combobox"
        aria-label="اندازه متن به پیکسل"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        inputMode="numeric"
        dir="ltr"
        value={shown}
        placeholder={current === null ? "—" : "پیش‌فرض"}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // ویرایشگر داخلِ فرمِ برند/سری/مقاله است؛ Enter نباید آن فرم را ثبت کند.
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          else if (event.key === "Tab") commit();
          else if (event.key === "Escape") { setDraft(null); setOpen(false); }
          else if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); }
        }}
        // با blur چیزی اعمال نمی‌شود (مثلِ Word): کلیک در ویرایشگر یعنی انتخابِ تازه،
        // و اعمالِ عدد روی آن غافلگیرکننده بود.
        onBlur={() => setDraft(null)}
        className="w-10 bg-transparent px-1 py-0.5 text-center text-[11px] text-gray-700 outline-none placeholder:text-[10px] placeholder:text-gray-400"
      />
      <span className="pl-0.5 text-[10px] text-gray-400">px</span>
      <button type="button" aria-label="فهرست اندازه‌ها" onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((value) => !value)} className="px-0.5 py-1 text-gray-400 hover:text-[var(--color-primary)]"><FiChevronDown /></button>
    </div>
    {invalid ? <span role="alert" className="absolute top-full right-0 z-20 mt-1 whitespace-nowrap rounded bg-white px-2 py-1 text-[10px] text-red-600 shadow">عددی بین {RICH_TEXT_PX_RANGE.min} تا {RICH_TEXT_PX_RANGE.max}</span> : null}
    {open ? <ul id={listId} role="listbox" aria-label="اندازه‌های متن" className="absolute top-full right-0 z-20 mt-1 max-h-60 w-28 overflow-y-auto border bg-white py-1 shadow-lg" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}>
      {[null, ...RICH_TEXT_PX_SIZES].map((px) => {
        const selected = px ? current === `${px}px` : current === "";
        return <li key={px ?? "default"} role="option" aria-selected={selected}>
          <button
            type="button"
            // انتخابِ ویرایشگر باید حفظ شود؛ بدونِ این، کلیک فوکوس را می‌گیرد.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(px)}
            dir={px ? "ltr" : "rtl"}
            className={`block w-full px-3 py-1 text-right text-xs hover:bg-[var(--color-primary-soft)] ${selected ? "font-bold text-[var(--color-primary)]" : "text-gray-700"}`}
          >{px ?? "پیش‌فرض"}</button>
        </li>;
      })}
    </ul> : null}
  </div>;
}

export default function RichTextField({ value, onChange, align, onAlign, singleLine = false }) {
  const ref = useRef(null);
  const savedRange = useRef(null);
  const [marks, setMarks] = useState({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [currentSize, setCurrentSize] = useState("");
  // رنگِ انتخاب‌شده در state است تا دکمه‌ی «اعمال رنگ» همیشه بداند چه رنگی را
  // دوباره بگذارد، حتی وقتی خودِ input رویدادی نداده است.
  const [colour, setColour] = useState("#aa4725");

  // همگام‌سازی فقط وقتی ویرایشگر فوکوس ندارد: حینِ تایپ، React نباید به محتوای
  // contentEditable دست بزند (مکان‌نما می‌پرد)، ولی بازیابیِ یک نسخه‌ی قدیمی یا
  // بارگذاریِ اولیه باید دیده شود. خروجیِ خودِ ما (serializeEditor) هم «همان
  // محتوا» حساب می‌شود؛ وگرنه رفتنِ فوکوس به کادرِ اندازه DOM را بازسازی می‌کرد و
  // انتخابِ ذخیره‌شده به گره‌های جداشده اشاره می‌کرد.
  useEffect(() => {
    const element = ref.current;
    if (!element || element === document.activeElement) return;
    const incoming = value?.html || escapeHtml(value?.text || "");
    if (element.innerHTML !== incoming && serializeEditor(element).html !== incoming) element.innerHTML = incoming;
  }, [value?.html, value?.text]);

  // آخرین انتخابِ داخلِ ویرایشگر همیشه نگه داشته می‌شود — با موس یا صفحه‌کلید —
  // تا کنترل‌های نوارِ ابزار (اندازه، پیوند) بعد از گرفتنِ فوکوس هم بدانند روی چه
  // متنی کار کنند. قبلاً فقط mousedown روی کشویی آن را ذخیره می‌کرد.
  useEffect(() => {
    const onSelection = () => {
      const root = ref.current;
      const selection = window.getSelection();
      if (!root || !selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      savedRange.current = range.cloneRange();
      setCurrentSize(readSelectionSize(range, root));
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  const emit = () => {
    const element = ref.current;
    if (element) onChange(serializeEditor(element));
  };

  const applySize = (px) => {
    const root = ref.current;
    const range = savedRange.current;
    if (!root || !range || !root.contains(range.commonAncestorContainer)) return;
    root.focus({ preventScroll: true });
    const next = applyFontSize(root, range, px);
    if (next) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(next);
      savedRange.current = next.cloneRange();
      setCurrentSize(readSelectionSize(next, root));
    }
    emit();
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

  // فوکوس پیش از بازگرداندن محدوده: execCommand روی عنصرِ فوکوس‌دار اثر می‌کند و
  // در این لحظه ممکن است فوکوس روی کادرِ نشانی یا انتخابگرِ رنگ باشد، نه ویرایشگر.
  const restoreRange = () => {
    const range = savedRange.current;
    if (!range || !ref.current?.contains(range.commonAncestorContainer)) return false;
    ref.current.focus();
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  };

  const exec = (command, argument) => {
    // فرمان باید روی *همان* انتخابی اجرا شود که کاربر داشت. اگر فوکوس جای
    // دیگری رفته (پنجره‌ی رنگِ سیستم، کادرِ نشانی، …)، محدوده‌ی ذخیره‌شده
    // برمی‌گردد — همان کاری که applyLink از قبل می‌کرد و بقیه‌ی فرمان‌ها نمی‌کردند.
    if (!insideEditor() && !restoreRange()) ref.current?.focus();
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
      <FontSizeControl current={currentSize} onApply={applySize} />

      {/* رنگ دو راهِ اعمال دارد، و دلیلش یک محدودیتِ خودِ پلتفرم است:
          <input type="color"> فقط وقتی رویداد می‌دهد که مقدارش *عوض شود*. اگر
          کاربر همان رنگِ قبلی را برای یک انتخابِ تازه بردارد (یا پنجره‌ی رنگ را
          بدونِ تغییر ببندد)، هیچ رویدادی نمی‌آید و ظاهراً «رنگ کار نمی‌کند» —
          دقیقاً همان چیزی که با پررنگ‌کردن هم‌زمان دیده می‌شد. پس انتخابِ رنگِ
          تازه بی‌درنگ اعمال می‌شود، و دکمه‌ی کنارش همیشه رنگِ فعلی را دوباره
          اعمال می‌کند. */}
      <label className="flex items-center" title="انتخاب رنگ متن">
        <input
          type="color"
          aria-label="انتخاب رنگ متن"
          value={colour}
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => { setColour(event.target.value); exec("foreColor", event.target.value); }}
          className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0"
        />
      </label>
      <ToolButton title="اعمال رنگ روی متن انتخاب‌شده" onClick={() => exec("foreColor", colour)}>
        <span aria-hidden="true" className="block h-3 w-3 rounded-full border border-black/20" style={{ background: colour }} />
      </ToolButton>

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
