/**
 * The fonts available to events.
 *
 * Each `value` is a font-family that is ALREADY registered:
 *  - Vazirmatn  → loaded via CDN <link> in the root layouts
 *  - the rest   → declared as @font-face in src/app/globals.css (files in /public/fonts)
 *
 * globals.css is imported by both the (Site) and (Admin-Panel) layouts, so any
 * family listed here renders correctly on the public event page and in the admin preview.
 *
 * To add a new font: drop the file in /public/fonts, add an @font-face block in
 * globals.css, then add an entry here. Nothing else needs to change.
 */
export const EVENT_FONTS = [
  { value: "Vazirmatn", label: "وزیر متن", sample: "نمونه متن فارسی Aa" },
  { value: "Lalezar", label: "لاله‌زار", sample: "نمونه متن فارسی Aa" },
  { value: "Gagalin", label: "Gagalin", sample: "Event Sample Aa" },
  { value: "Nevera", label: "Nevera", sample: "Event Sample Aa" },
  { value: "Astron-Valley", label: "Astron Valley", sample: "Event Sample Aa" },
  { value: "Savery", label: "Savery", sample: "Event Sample Aa" },
  { value: "Lotos-Bold", label: "Lotos Bold", sample: "Event Sample Aa" },
  { value: "Heralgliph", label: "Heralgliph", sample: "Event Sample Aa" },
  { value: "IranNastaliq", label: "ایران نستعلیق", sample: "نمونه خط نستعلیق" },
];

export const DEFAULT_FONT = "Vazirmatn";
