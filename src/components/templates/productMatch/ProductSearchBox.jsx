'use client';

import { useState, useEffect } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';

// جستجوی محصول پایه — از همان API جستجوی مقایسه استفاده می‌کند
export default function ProductSearchBox({ categoryId, categoryTitle, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/compare/search?q=${encodeURIComponent(query)}&categoryId=${categoryId}`
        );
        const data = await res.json();
        if (!cancelled) setResults(data.products || []);
      } catch (err) {
        console.error('Error fetching search results:', err);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, categoryId]);

  return (
    <div className="relative w-full">
      <div className="relative group">
        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-neutral-400 group-focus-within:text-[var(--color-primary)] transition-colors">
          <FiSearch size={22} />
        </div>
        <input
          type="text"
          className="block w-full p-5 pr-12 text-lg text-gray-900 border-2 border-neutral-200 rounded-2xl bg-white focus:ring-0 focus:border-[var(--color-primary)] shadow-sm focus:shadow-md transition-all outline-none"
          placeholder={`محصول فعلی خود را در دسته "${categoryTitle}" جستجو کنید...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.length > 0 && !isSearching && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 left-0 flex items-center pl-4 text-neutral-400 hover:text-neutral-600"
            aria-label="پاک کردن جستجو"
          >
            <FiX size={20} />
          </button>
        )}
        {isSearching && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-4">
            <div className="w-5 h-5 border-2 border-[var(--color-secondary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {query.length >= 2 && (
        <div className="absolute top-full right-0 w-full mt-2 bg-white border border-neutral-100 rounded-xl shadow-xl overflow-hidden z-50">
          {results.length > 0 ? (
            <ul className="max-h-[300px] overflow-y-auto divide-y divide-neutral-100">
              {results.map((item) => (
                <li key={item._id}>
                  <button
                    onClick={() => {
                      onSelect(item);
                      setQuery('');
                      setResults([]);
                    }}
                    className="w-full px-5 py-4 hover:bg-neutral-50 flex items-center gap-4 transition-colors text-right"
                  >
                    <div className="w-12 h-12 bg-neutral-100 rounded-lg overflow-hidden shrink-0">
                      <img
                        src={item.mainImage || '/placeholder.png'}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="font-bold text-neutral-800 line-clamp-1">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !isSearching && (
              <div className="p-6 text-center text-neutral-500">
                محصولی با این نام در این دسته‌بندی وجود ندارد.
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
