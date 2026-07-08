"use client";

import styles from "./RouteLoader.module.css";

/**
 * لودر روت — نسخهٔ ساده‌شدهٔ فاز ۱:
 * فقط یک دایرهٔ چرخانِ سبز درباری در وسط صفحه، بدون لوگو یا انیمیشن اضافه.
 * رنگ خودکار با تم ادمین هارمونی دارد (var(--color-primary))؛ در بیرون از
 * admin-scope هم مقدارِ سراسری --color-primary سایت را می‌گیرد و بی‌ریسک است.
 */
export default function RouteLoader() {
  return (
    <div className={styles.overlay} role="status" aria-label="در حال بارگذاری">
      <span className={styles.spinner} aria-hidden="true" />
    </div>
  );
}
