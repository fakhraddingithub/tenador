"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";

export default function ProductCardTitle({ name, slug, farsi, english }) {
  const slotRef = useRef(null);
  const textRef = useRef(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const text = textRef.current;
    let disposed = false;

    const fit = () => {
      if (disposed || !slot.clientWidth) return;

      // Start at the original size, including when a narrow card becomes wider.
      const setScale = (scale) => text.style.setProperty("--title-scale", scale);
      setScale(1);
      const style = getComputedStyle(slot);
      const availableHeight = slot.clientHeight
        - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const fits = () => text.getBoundingClientRect().height <= availableHeight
        && text.scrollWidth <= text.clientWidth;

      if (fits()) return;

      // Measure actual wrapped text rather than guessing from character counts.
      // Only the text changes size; the card's 60px title slot stays fixed.
      let low = 0;
      let high = 1;
      for (let step = 0; step < 10; step += 1) {
        const scale = (low + high) / 2;
        setScale(scale);
        if (fits()) low = scale;
        else high = scale;
      }
      setScale(low);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(slot);
    document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);

    return () => {
      disposed = true;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [farsi, english]);

  return (
    <Link
      ref={slotRef}
      href={`/products/${slug}`}
      className="mb-4 block h-[60px] w-full min-w-0 shrink-0 overflow-hidden py-0.5 pointer-events-auto [overflow-wrap:anywhere] [-webkit-text-size-adjust:100%] [text-size-adjust:100%]"
      title={name}
    >
      <div ref={textRef} style={{ "--title-scale": 1 }}>
        {farsi && (
          <h3
            className="font-bold text-gray-800"
            style={{
              fontSize: "calc(14px * var(--title-scale))",
              lineHeight: "calc(24px * var(--title-scale))",
              marginBottom: english ? "calc(4px * var(--title-scale))" : 0,
            }}
          >{farsi}</h3>
        )}
        {english && (
          <p
            dir="ltr"
            className="font-medium text-gray-800"
            style={{
              direction: "ltr",
              fontSize: "calc(12px * var(--title-scale))",
              lineHeight: "calc(16px * var(--title-scale))",
            }}
          >{english}</p>
        )}
      </div>
    </Link>
  );
}
