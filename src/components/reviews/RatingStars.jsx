"use client";

import { useState } from "react";
import { FaStar, FaStarHalfAlt, FaRegStar } from "react-icons/fa";

/**
 * RatingStars — هم برای نمایش امتیاز (readOnly) و هم برای انتخاب امتیاز (input).
 *
 * - حالت نمایش: value می‌تواند اعشاری باشد (مثل ۴.۵) و نیم‌ستاره رندر می‌شود.
 * - حالت ورودی: onChange بدهید؛ کنترلِ کیبوردی و hover فعال می‌شود.
 */
export default function RatingStars({
  value = 0,
  onChange,
  size = 18,
  readOnly = !onChange,
  className = "",
  label = "امتیاز",
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  if (readOnly) {
    return (
      <div
        className={`flex items-center gap-0.5 ${className}`}
        role="img"
        aria-label={`${value} از ۵`}
        style={{ color: "#ffbf00" }}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          if (value >= i) return <FaStar key={i} size={size} />;
          if (value >= i - 0.5) return <FaStarHalfAlt key={i} size={size} />;
          return <FaRegStar key={i} size={size} className="text-gray-300" />;
        })}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="radiogroup"
      aria-label={label}
      dir="ltr"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} ستاره`}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(i)}
          className="cursor-pointer rounded-full p-0.5 transition-transform duration-150 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aa4725]/60"
          style={{ color: active >= i ? "#ffbf00" : "#d1d5db" }}
        >
          {active >= i ? <FaStar size={size} /> : <FaRegStar size={size} />}
        </button>
      ))}
    </div>
  );
}
