"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Reveal — جزیره‌ی کلاینتِ کوچک برای انیمیشنِ ورود هنگام اسکرول.
 * با prefers-reduced-motion، انیمیشن غیرفعال و محتوا بلافاصله نمایش داده می‌شود.
 *
 * props:
 *  - as: تگ موشن (پیش‌فرض div)
 *  - delay: تأخیر (ثانیه)
 *  - y: جابه‌جایی اولیه عمودی
 *  - once: فقط یک‌بار اجرا شود (پیش‌فرض true)
 */
export default function Reveal({
  children,
  className = "",
  delay = 0,
  y = 24,
  once = true,
  ...rest
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
