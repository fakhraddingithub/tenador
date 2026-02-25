export function createSlug(text) {
  if (!text) return "";

  return text
    .toString()
    .trim()
    .toLowerCase()
    // 1. جایگزینی ی و ک عربی با فارسی برای یکدستی
    .replace(/ی/g, 'ی')
    .replace(/ک/g, 'ک')
    // 2. حذف کاراکترهای غیرمجاز و نگه داشتن حروف فارسی و انگلیسی و اعداد
    .replace(/[^\p{L}\p{N}\s-]/gu, "") 
    // 3. تبدیل فضاها به خط تیره
    .replace(/\s+/g, "-")
    // 4. حذف خط تیره‌های تکراری
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
