"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Multi-select autocomplete for picking real entities (products, brands,
 * series, categories, sports) by name. Reuses the shared
 * /api/admin/discounts/search endpoint, which returns { items: [{_id, label, image, sub}] }
 * and also resolves a batch of ids back to labels (for edit mode).
 *
 * Stores selected ids as an array of strings via `onChange(ids)`. Keeps the
 * human-readable labels in local state so chips render even after a reload.
 *
 * The results dropdown is absolutely positioned inside a relative wrapper and
 * capped (max-height + scroll), so it never overflows the surrounding card.
 */
export default function EventEntityPicker({
  searchType,
  value = [],
  onChange,
  placeholder = "نام را تایپ کنید...",
}) {
  const [selected, setSelected] = useState([]); // [{_id, label, image}]
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const wrapRef = useRef(null);
  const timer = useRef(null);
  const resolvedKey = useRef("");

  // Resolve incoming ids → labels (edit mode / external value change).
  // All setState happens inside the async closure so the effect body itself
  // never updates state synchronously.
  useEffect(() => {
    const ids = (value || []).map(String).filter(Boolean);
    const key = ids.join(",");
    if (key === resolvedKey.current) return;
    resolvedKey.current = key;

    let cancelled = false;
    (async () => {
      if (!ids.length) {
        if (!cancelled) setSelected([]);
        return;
      }
      // Skip refetch if we already hold labels for exactly these ids.
      const have = selected.map((s) => s._id).sort().join(",");
      if (have === ids.slice().sort().join(",")) return;

      try {
        const res = await fetch(
          `/api/admin/discounts/search?type=${searchType}&ids=${encodeURIComponent(ids.join(","))}`
        );
        const data = await res.json();
        if (cancelled) return;
        const items = (data.items || []).map((i) => ({
          _id: String(i._id),
          label: i.label,
          image: i.image || null,
        }));
        // Preserve any ids the API couldn't resolve so the count stays correct.
        const found = new Set(items.map((i) => i._id));
        const missing = ids
          .filter((id) => !found.has(id))
          .map((id) => ({ _id: id, label: id, image: null }));
        setSelected([...items, ...missing]);
      } catch {
        if (!cancelled) setSelected(ids.map((id) => ({ _id: id, label: id, image: null })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, searchType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click.
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const runSearch = useCallback(
    async (q) => {
      if (!q || !searchType) {
        setResults([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/discounts/search?type=${searchType}&q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        setResults(data.items || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [searchType]
  );

  const onQueryChange = (val) => {
    setQuery(val);
    clearTimeout(timer.current);
    if (!val.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => runSearch(val), 300);
  };

  const emit = (items) => {
    setSelected(items);
    resolvedKey.current = items.map((i) => i._id).join(",");
    onChange(items.map((i) => i._id));
  };

  const add = (item) => {
    const id = String(item._id);
    if (selected.some((s) => s._id === id)) return;
    emit([...selected, { _id: id, label: item.label, image: item.image || null }]);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const remove = (id) => emit(selected.filter((s) => s._id !== id));

  return (
    <div className="space-y-2" ref={wrapRef}>
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((item) => (
            <span
              key={item._id}
              className="inline-flex items-center gap-1.5 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 text-[var(--color-primary)] text-xs font-bold px-2.5 py-1 rounded-full"
            >
              {item.image && (
                <img src={item.image} alt="" className="w-4 h-4 rounded-full object-cover" />
              )}
              {item.label}
              <button
                type="button"
                onClick={() => remove(item._id)}
                className="text-[var(--color-primary)]/60 hover:text-[var(--color-primary)] font-black leading-none"
                aria-label={`حذف ${item.label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input + results */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => query && results.length && setOpen(true)}
          autoComplete="off"
          placeholder={placeholder}
          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-[var(--radius)] text-sm font-bold focus:outline-none focus:border-[var(--color-primary)] transition-all"
        />
        {loading && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
            جستجو...
          </span>
        )}

        {open && (
          <ul className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-2xl">
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-400 text-center">موردی یافت نشد</li>
            ) : (
              results.map((item) => (
                <li key={String(item._id)}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(item);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-none text-right"
                  >
                    {item.image ? (
                      <img src={item.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-gray-100 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{item.label}</p>
                      {item.sub && <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
