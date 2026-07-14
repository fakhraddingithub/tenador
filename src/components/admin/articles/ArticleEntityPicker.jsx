"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { FiSearch, FiX } from "react-icons/fi";

export default function ArticleEntityPicker({ type, value, onChange, multiple = true, placeholder = "جستجو..." }) {
  const resultsId = useId();
  const ids = multiple ? (Array.isArray(value) ? value : []) : value ? [value] : [];
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const searchController = useRef(null);

  useEffect(() => {
    const key = ids.map(String).join(",");
    if (!key) { Promise.resolve().then(() => setSelected([])); return; }
    const controller = new AbortController();
    fetch(`/api/admin/article-cms/entities?type=${type}&ids=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setSelected(data.items || []))
      .catch((error) => { if (error.name !== "AbortError") setSelected([]); });
    return () => controller.abort();
  }, [type, ids.map(String).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const search = useCallback(async (term) => {
    if (!term.trim()) return setResults([]);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/article-cms/entities?type=${type}&q=${encodeURIComponent(term)}`);
      const data = await res.json();
      setResults(data.items || []);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => () => {
    clearTimeout(timer.current);
    searchController.current?.abort();
  }, []);

  const changeQuery = (next) => {
    setQuery(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(next), 250);
  };

  const add = (item) => {
    const id = String(item._id);
    if (multiple) onChange([...new Set([...ids.map(String), id])]);
    else onChange(id);
    setQuery("");
    setResults([]);
  };
  const remove = (id) => multiple ? onChange(ids.filter((item) => String(item) !== String(id))) : onChange(null);

  return (
    <div className="space-y-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <span key={item._id} className="inline-flex items-center gap-2 px-2 py-1.5 border text-xs font-bold" style={{ borderColor: "var(--admin-border)", background: "var(--color-primary-soft)", color: "var(--color-primary)", borderRadius: "var(--admin-radius)" }}>
              {item.image ? <Image src={item.image} alt="" width={24} height={24} className="h-6 w-6 rounded object-cover" /> : null}
              <span className="max-w-48 truncate">{item.label}</span>
              <button type="button" onClick={() => remove(item._id)} aria-label={`حذف ${item.label}`}><FiX /></button>
            </span>
          ))}
        </div>
      ) : null}
      {multiple || selected.length === 0 ? (
        <div className="relative">
          <FiSearch className="absolute right-3 top-3 text-gray-400" />
          <input role="combobox" aria-controls={resultsId} aria-expanded={Boolean(query)} aria-autocomplete="list" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={placeholder} className="w-full pr-9 pl-3 py-2.5 border bg-gray-50 text-sm outline-none focus:border-[var(--color-primary)]" style={{ borderColor: "var(--admin-border)", borderRadius: "var(--admin-radius)" }} />
          {query ? (
            <div id={resultsId} role="listbox" className="absolute z-50 top-full right-0 left-0 mt-1 max-h-64 overflow-y-auto a-card shadow-lg">
              {loading ? <p className="p-3 text-xs text-gray-400">در حال جستجو...</p> : results.map((item) => (
                <button key={item._id} role="option" aria-selected="false" type="button" onClick={() => add(item)} className="w-full flex items-center gap-3 p-3 text-right hover:bg-[var(--color-primary-soft)] border-b last:border-0" style={{ borderColor: "var(--admin-border)" }}>
                  {item.image ? <Image src={item.image} alt="" width={36} height={36} className="h-9 w-9 rounded object-cover" /> : <span className="w-9 h-9 bg-gray-100 rounded" />}
                  <span className="min-w-0"><strong className="block text-sm truncate">{item.label}</strong>{item.sub ? <small className="text-gray-400">{item.sub}</small> : null}</span>
                </button>
              ))}
              {!loading && results.length === 0 ? <p className="p-3 text-xs text-gray-400">نتیجه‌ای یافت نشد</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
