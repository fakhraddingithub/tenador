"use client";

import { useEffect, useMemo, useState } from "react";

const CHUNK_SIZE = 60;

export default function useDeferredProducts(initialProducts, totalResults, listingFilter) {
  const [products, setProducts] = useState(initialProducts || []);
  const [isLoadingMore, setIsLoadingMore] = useState(
    (initialProducts?.length || 0) < (totalResults || 0),
  );
  const filterKey = useMemo(() => JSON.stringify(listingFilter || {}), [listingFilter]);

  useEffect(() => {
    const firstPage = initialProducts || [];
    const total = Number(totalResults) || firstPage.length;

    const controller = new AbortController();
    let cancelled = false;

    async function loadRemaining() {
      setProducts(firstPage);
      setIsLoadingMore(firstPage.length < total);
      if (firstPage.length >= total) return;
      let offset = firstPage.length;

      try {
        while (!cancelled && offset < total) {
          const params = new URLSearchParams({
            offset: String(offset),
            limit: String(CHUNK_SIZE),
          });
          const filter = JSON.parse(filterKey);
          for (const [key, value] of Object.entries(filter)) {
            if (value) params.set(key, String(value));
          }

          const response = await fetch(`/api/storefront/products?${params}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          const nextProducts = Array.isArray(data.products) ? data.products : [];
          if (nextProducts.length === 0) break;

          setProducts((current) => {
            const ids = new Set(current.map((product) => product._id));
            return current.concat(nextProducts.filter((product) => !ids.has(product._id)));
          });
          offset += nextProducts.length;
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Deferred product loading failed:", error);
        }
      } finally {
        if (!cancelled) setIsLoadingMore(false);
      }
    }

    // Let the initial page paint before requesting non-critical pages.
    const timer = window.setTimeout(loadRemaining, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [initialProducts, totalResults, filterKey]);

  return { products, isLoadingMore };
}
