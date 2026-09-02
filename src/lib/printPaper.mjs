/**
 * src/lib/printPaper.mjs
 *
 * ابعادِ کاغذهای پشتیبانی‌شده‌ی برگه‌ی چاپ + «پیچِ مقیاس».
 *
 * `base` همان `font-size` ریشه‌ی برگه است. همه‌ی اندازه‌های داخلِ برگه بر حسبِ
 * `em` نوشته شده‌اند، پس تغییرِ همین یک عدد کلِ ترکیب‌بندی را متناسب کوچک/بزرگ
 * می‌کند — متن، فاصله‌ها، لوگو، ضخامتِ کادر و جای فرستنده/گیرنده با هم. هیچ
 * عنصری جداگانه مقیاس نمی‌گیرد.
 *
 * A5 دقیقاً ۱/√۲ برابرِ A4 است (ISO 216)، پس `base` هم باید همان نسبت را
 * داشته باشد؛ tests/senderAddressForm.test.mjs همین را قفل می‌کند.
 *
 * ماژولِ خالص و بدونِ JSX تا تست هم بتواند مستقیم import اش کند.
 */

export const PAPER = {
  A4: { css: "A4 landscape", width: "297mm", height: "210mm", base: "3.2mm" },
  A5: { css: "A5 landscape", width: "210mm", height: "148mm", base: "2.26mm" },
};

export const PAPER_SIZES = Object.keys(PAPER);
