"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { FiSearch, FiX } from "react-icons/fi";
import { FloatingPanel } from "./blockUi";

/**
 * انتخابِ محصول/برند/مقاله/… برای بلوک‌ها.
 *
 * params: پارامترهای اضافه‌ی جستجو (مثلاً { sport } برای سری‌های یک ورزش).
 * browse: با فوکوس، بدونِ تایپ هم فهرستِ کامل باز می‌شود (فهرست‌های کوچک).
 * disabledHint: جستجو غیرفعال است و این متن دلیلش را می‌گوید.
 * allByDefault: مقدارِ غایب یعنی «همه» (نوارِ برندها) — کلِ فهرست به‌شکلِ چیپ نشان
 *   داده می‌شود؛ برداشتنِ یکی فهرستِ صریحِ بقیه را ذخیره می‌کند و جستجو فقط
 *   برداشته‌ها را برای برگرداندن پیشنهاد می‌دهد.
 *
 * نتایج در FloatingPanel باز می‌شوند — بیرون از هر ظرفِ overflow‌دار (مودالِ
 * پیش‌نمایش، کارتِ بلوک)، پس هیچ‌جا زیرِ محتوا نمی‌روند یا بریده نمی‌شوند.
 */
export default function ArticleEntityPicker({ type, value, onChange, multiple = true, placeholder = "جستجو...", label, params, browse = false, disabledHint, allByDefault = false }) {
  const resultsId = useId();
  const allMode = allByDefault && multiple && !Array.isArray(value);
  const [allItems, setAllItems] = useState(null);
  const ids = allMode ? (allItems || []).map((item) => String(item._id)) : multiple ? (Array.isArray(value) ? value : []) : value ? [value] : [];
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const timer = useRef(null);
  const searchController = useRef(null);
  const anchor = useRef(null);
  const extra = params ? Object.entries(params).map(([key, val]) => `&${key}=${encodeURIComponent(val ?? "")}`).join("") : "";
  const disabled = Boolean(disabledHint);

  // «همه»: فهرستِ کامل یک‌بار خوانده می‌شود و همان چیپ‌هاست.
  useEffect(() => {
    if (!allMode) return undefined;
    const controller = new AbortController();
    fetch(`/api/admin/article-cms/entities?type=${type}&all=1`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setAllItems(data.items || []))
      .catch((error) => { if (error.name !== "AbortError") setAllItems([]); });
    return () => controller.abort();
  }, [allMode, type]);

  useEffect(() => {
    if (allMode) { Promise.resolve().then(() => setSelected(allItems || [])); return; }
    const key = ids.map(String).join(",");
    if (!key) { Promise.resolve().then(() => setSelected([])); return; }
    const controller = new AbortController();
    fetch(`/api/admin/article-cms/entities?type=${type}&ids=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setSelected(data.items || []))
      .catch((error) => { if (error.name !== "AbortError") setSelected([]); });
    return () => controller.abort();
  }, [type, allMode, allItems, ids.map(String).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = useCallback(async (term) => {
    if (!term.trim() && !browse) return setResults([]);
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/article-cms/entities?type=${type}&q=${encodeURIComponent(term)}${extra}`, { signal: controller.signal });
      const data = await res.json();
      setResults(data.items || []);
    } catch (error) {
      if (error.name !== "AbortError") setResults([]);
    } finally {
      if (searchController.current === controller) setLoading(false);
    }
  }, [type, extra, browse]);

  useEffect(() => () => {
    clearTimeout(timer.current);
    searchController.current?.abort();
  }, []);

  // دامنه عوض شد (ورزشِ دیگر): نتایجِ قبلی متعلق به دامنه‌ی قبلی‌اند.
  useEffect(() => { Promise.resolve().then(() => setResults([])); }, [extra]);
  // کادرِ فوکوس‌خورده‌ای که غیرفعال می‌شود (ورزش برداشته شد) در Chrome رویدادِ blur
  // نمی‌دهد؛ بدونِ این، فیلد خودش را هنوز فوکوس‌خورده می‌دانست.
  useEffect(() => { if (disabled) Promise.resolve().then(() => setFocused(false)); }, [disabled]);

  const changeQuery = (next) => {
    setQuery(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(next), 250);
  };

  const onFocus = () => {
    setFocused(true);
    if (browse && !query) search("");
  };

  const add = (item) => {
    const id = String(item._id);
    if (multiple) onChange([...new Set([...ids.map(String), id])]);
    else onChange(id);
    setQuery("");
    // در حالتِ browse فهرست باز می‌ماند تا چند مورد پشتِ‌سرِ‌هم انتخاب شود.
    if (!browse || !multiple) setResults([]);
  };
  const remove = (id) => multiple ? onChange(ids.filter((item) => String(item) !== String(id))) : onChange(null);

  // چیپ‌ها به ترتیبِ ذخیره‌شده (همان ترتیبی که اسلایدرها رندر می‌کنند)، نه ترتیبِ
  // پاسخِ دیتابیس — وگرنه فهرست ترتیبِ دیگری از خروجیِ واقعی نشان می‌داد.
  const byId = new Map(selected.map((item) => [String(item._id), item]));
  const chips = ids.map((id) => byId.get(String(id))).filter(Boolean);
  const chosen = new Set(ids.map(String));
  const visible = results.filter((item) => !chosen.has(String(item._id)));
  const open = focused && !disabled && (Boolean(query) || (browse && (loading || results.length > 0)));

  return (
    <div className="space-y-2">
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((item) => (
            <span key={item._id} className="inline-flex items-center gap-2 px-2 py-1.5 border text-xs font-bold" style={{ borderColor: "var(--admin-border)", background: "var(--color-primary-soft)", color: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}>
              {item.image ? <Image src={item.image} alt="" width={24} height={24} className="h-6 w-6 rounded object-cover" /> : null}
              <span className="max-w-48 truncate">{item.label}</span>
              <button type="button" onClick={() => remove(item._id)} aria-label={`حذف ${item.label}`}><FiX /></button>
            </span>
          ))}
        </div>
      ) : null}
      {multiple || selected.length === 0 ? (
        <div className="relative" ref={anchor}>
          <FiSearch className="absolute right-2.5 top-2.5 text-gray-400" />
          <input
            role="combobox"
            aria-label={label}
            aria-controls={resultsId}
            aria-expanded={open}
            aria-autocomplete="list"
            value={query}
            disabled={disabled}
            onChange={(event) => changeQuery(event.target.value)}
            onFocus={onFocus}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              // Escape اول فهرست را می‌بندد؛ مودالِ پیش‌نمایش فقط Escape ـِ بعدی را می‌گیرد.
              if (event.key === "Escape" && open) { event.stopPropagation(); setQuery(""); setResults([]); event.currentTarget.blur(); }
              // ویرایشگر داخلِ فرمِ برند/سری است؛ Enter نباید آن فرم را ثبت کند.
              if (event.key === "Enter") event.preventDefault();
            }}
            placeholder={disabledHint || placeholder}
            className="w-full pr-8 pl-2.5 py-1.5 border bg-gray-50 text-sm outline-none focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }}
          />
          {/* mousedown روی فهرست فوکوس را از کادر نمی‌گیرد؛ بدونِ آن blur پیش از
              کلیک فهرست را می‌بست و انتخاب هرگز ثبت نمی‌شد. */}
          <FloatingPanel anchorRef={anchor} open={open} id={resultsId} role="listbox" className="a-card shadow-lg" onMouseDown={(event) => event.preventDefault()}>
            {loading && !visible.length ? <p className="p-3 text-xs text-gray-400">در حال جستجو...</p> : visible.map((item) => (
              <button key={item._id} role="option" aria-selected="false" type="button" onClick={() => add(item)} className="w-full flex items-center gap-3 p-3 text-right hover:bg-[var(--color-primary-soft)] border-b last:border-0" style={{ borderColor: "var(--admin-border)" }}>
                {item.image ? <Image src={item.image} alt="" width={36} height={36} className="h-9 w-9 rounded object-cover" /> : <span className="w-9 h-9 bg-gray-100 rounded" />}
                <span className="min-w-0"><strong className="block text-sm truncate">{item.label}</strong>{item.sub ? <small className="text-gray-400">{item.sub}</small> : null}</span>
              </button>
            ))}
            {!loading && visible.length === 0 ? <p className="p-3 text-xs text-gray-400">{results.length ? "همه‌ی موارد انتخاب شده‌اند" : "نتیجه‌ای یافت نشد"}</p> : null}
          </FloatingPanel>
        </div>
      ) : null}
    </div>
  );
}
