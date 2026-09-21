/**
 * چیدمانِ کنارِ‌هم قرارگرفتنِ بلوک‌ها.
 *
 * هیچ «سطر»ی در داده ذخیره نمی‌شود؛ فقط هر بلوک عرضِ خودش را دارد و سطرها هنگامِ
 * رندر دوباره ساخته می‌شوند. برای همین جابه‌جایی، تکثیر و حذفِ بلوک هرگز نمی‌تواند
 * ساختار را خراب کند. نبودِ layout یعنی تمام‌عرض — دقیقاً رفتارِ مقاله‌های قبلی.
 *
 * این ماژول عمداً هیچ وابستگی‌ای ندارد تا هم رندرِ عمومی و هم تست بتوانند
 * مستقیم واردش کنند (mongoose نباید به کامپوننت راه پیدا کند).
 */

/** پایه‌ی ۶ ستونی: نصف/یک‌سوم/دوسوم هر سه دقیق در می‌آیند. */
export const BLOCK_WIDTH_SPANS = { "1/2": 3, "1/3": 2, "2/3": 4 };

export const BLOCK_WIDTHS = ["full", ...Object.keys(BLOCK_WIDTH_SPANS)];

/** کلاسِ ستونیِ هر عرض. رشته‌ها باید عینی باشند تا تیلویند آن‌ها را بسازد. */
export const BLOCK_WIDTH_CLASS = {
  "1/2": "md:col-span-3",
  "1/3": "md:col-span-2",
  "2/3": "md:col-span-4",
};

/**
 * درجِ یک بلوک در موقعیتِ ۱-پایه‌ی دلخواه.
 *
 * ترتیبِ بلوک‌ها همان اندیسِ آرایه است و هیچ شماره‌ای جداگانه ذخیره نمی‌شود، پس
 * درج خودبه‌خود بلوک‌های بعدی را یک شماره جلو می‌برد و شماره‌ی تکراری یا جاافتاده
 * ممکن نیست. موقعیتِ نامعتبر یا بیرونِ بازه به انتهای فهرست بریده می‌شود.
 */
export function insertBlockAt(items = [], block, position) {
  const requested = Number.parseInt(position, 10);
  const index = Number.isNaN(requested) ? items.length : Math.min(Math.max(requested - 1, 0), items.length);
  return [...items.slice(0, index), block, ...items.slice(index)];
}


// ——— جعبه‌ی بلوک: عرضِ درصدی، فاصله‌ی هر طرف، و جای‌گیریِ افقی/عمودی ————————
// این‌ها *مستقل* از width بالا هستند و با هم تداخل ندارند: width می‌گوید بلوک
// چه سهمی از سطر را می‌گیرد (گروه‌بندیِ سطرها)، اینجا می‌گوید داخلِ همان سهم چه
// اندازه‌ای باشد و کجا بنشیند. نبودِ هر کلید یعنی رفتارِ قبلی، پس محتوای موجود
// بدونِ مهاجرت دقیقاً مثلِ قبل رندر می‌شود.

/** در RTL «راست» شروعِ خط است؛ نگاشت به flex در رندر انجام می‌شود. */
export const BLOCK_ALIGN_X = ["right", "center", "left"];
export const BLOCK_ALIGN_Y = ["top", "center", "bottom"];
export const BLOCK_MARGIN_KEYS = ["mt", "mb", "ml", "mr"];

/** درصدِ عرض: زیرِ ۵٪ عملاً نامرئی است و بالای ۱۰۰ سرریز می‌کند. */
export const BLOCK_WIDTH_PCT = { min: 5, max: 100, step: 1 };
/** فاصله‌ها به rem؛ سقفِ ۸ یعنی ۱۲۸px که برای یک بلوک بیش از کافی است. */
export const BLOCK_MARGIN_REM = { min: 0, max: 8, step: 0.25 };

const clamp = (value, { min, max, step }) => {
  const number = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(number)) return undefined;
  const stepped = Math.round(number / step) * step;
  // گردکردنِ شناور: 0.30000000000000004 نباید ذخیره شود.
  return Math.min(Math.max(Number(stepped.toFixed(4)), min), max);
};

export const clampBlockWidthPct = (value) => clamp(value, BLOCK_WIDTH_PCT);
export const clampBlockMargin = (value) => clamp(value, BLOCK_MARGIN_REM);

export function sanitizeArticleBlockLayout(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const layout = {};
  // "full" پیش‌فرض است و ذخیره نمی‌شود تا بلوکِ بدونِ چیدمان واقعاً بدونِ کلید بماند.
  if (BLOCK_WIDTH_SPANS[value.width]) layout.width = value.width;

  // ۱۰۰٪ هم پیش‌فرض است و ذخیره نمی‌شود — «تمامِ سهمِ خودش».
  const widthPct = clampBlockWidthPct(value.widthPct);
  if (widthPct !== undefined && widthPct !== 100) layout.widthPct = widthPct;

  // صفر مقدارِ معناداری است (یعنی «فاصله‌ی پیش‌تنظیمِ style را هم خنثی کن»)، پس
  // برخلافِ بقیه‌ی پیش‌فرض‌ها حذف نمی‌شود؛ فقط *نبودِ* کلید یعنی «دست نزن».
  for (const key of BLOCK_MARGIN_KEYS) {
    const margin = clampBlockMargin(value[key]);
    if (margin !== undefined) layout[key] = margin;
  }

  // "right" شروعِ خط است، یعنی همان جایی که بلوک بدونِ تنظیم می‌نشیند.
  if (BLOCK_ALIGN_X.includes(value.alignX) && value.alignX !== "right") layout.alignX = value.alignX;
  if (BLOCK_ALIGN_Y.includes(value.alignY) && value.alignY !== "top") layout.alignY = value.alignY;
  // پیش‌فرض: در موبایل بلوک تمام‌عرض می‌شود تا هیچ درصدی سرریز نسازد.
  if (value.keepOnMobile === true) layout.keepOnMobile = true;

  return Object.keys(layout).length ? layout : undefined;
}

/**
 * چیدمان را به متغیرهای CSS ترجمه می‌کند. کلاسِ .a-block-box (در globals.css)
 * تصمیم می‌گیرد این متغیرها از کدام breakpoint اعمال شوند — با inline style
 * نمی‌شود media query نوشت، و همین جداسازی است که «واکنش‌گرایی» را از «چیدمان»
 * جدا نگه می‌دارد.
 *
 * خروجیِ null یعنی این بلوک هیچ جعبه‌ای لازم ندارد و باید دقیقاً مثلِ قبل (بدونِ
 * هیچ wrapper اضافه‌ای) رندر شود.
 */
export function blockBoxStyle(block) {
  const layout = block?.layout;
  if (!layout || typeof layout !== "object") return null;

  const vars = {};
  const widthPct = clampBlockWidthPct(layout.widthPct);
  if (widthPct !== undefined && widthPct !== 100) vars["--bw"] = `${widthPct}%`;
  for (const key of BLOCK_MARGIN_KEYS) {
    const margin = clampBlockMargin(layout[key]);
    if (margin !== undefined) vars[`--b${key.slice(1)}`] = `${margin}rem`;
  }
  if (!Object.keys(vars).length) return null;

  // فاصله‌ی افقی از عرض کم می‌شود، نه اینکه رویش سوار شود: بلوکِ ۱۰۰٪ با حاشیه‌ی
  // چپ و راست هم هرگز از ظرفش بیرون نمی‌زند. (بدونِ حاشیه‌ی منفی، بدونِ سرریز.)
  const side = (clampBlockMargin(layout.ml) || 0) + (clampBlockMargin(layout.mr) || 0);
  if (side) vars["--bmx"] = `${side}rem`;
  return vars;
}

/** جای‌گیریِ افقیِ جعبه داخلِ سهمِ خودش. در RTL شروعِ خط سمتِ راست است. */
export const BLOCK_JUSTIFY = { right: "flex-start", center: "center", left: "flex-end" };
export const BLOCK_ALIGN_SELF = { top: "start", center: "center", bottom: "end" };

/**
 * کلاس و استایلِ جعبه، آماده برای نشستن روی *هر* عنصری که سهمِ بلوک است:
 * wrapperِ بلوکِ سطحِ‌اول، یا خانه‌ی خودِ فرزند داخلِ بلوکِ ادغام‌شده. همین است که
 * می‌گذارد فرزندِ ادغام‌شده بدونِ یک wrapper اضافه (و بدونِ جنگِ specificity با
 * ریستِ حاشیه‌ی خانه) دقیقاً همان تنظیمات را بگیرد.
 *
 * null یعنی این بلوک چیدمانی ندارد و باید عیناً مثلِ قبل رندر شود.
 * هم‌ترازیِ عمودی اینجا نیست: آن خاصیتِ *خانه* است، نه جعبه، و همان‌جا اعمال می‌شود.
 */
export function blockBoxProps(block) {
  const vars = blockBoxStyle(block);
  const justify = BLOCK_JUSTIFY[block?.layout?.alignX];
  if (!vars && !justify) return null;
  return {
    className: `a-block-box${block?.layout?.keepOnMobile ? " a-block-box--keep" : ""}`,
    style: { ...(vars || {}), ...(justify ? { "--bj": justify } : null) },
  };
}

/** عرضِ مؤثرِ یک بلوک؛ هر چیزِ ناشناخته تمام‌عرض حساب می‌شود. */
export function blockWidth(block) {
  const width = block?.layout?.width;
  return BLOCK_WIDTH_SPANS[width] ? width : "full";
}

/**
 * بلوک‌های اندازه‌دارِ پشتِ‌سرِ‌هم را در یک گروه جمع می‌کند؛ بلوکِ تمام‌عرض همیشه
 * گروه را می‌بندد و خودش تنها می‌ماند.
 *
 * گروهی که بیش از ۶ ستون شود را نمی‌شکنیم — خودِ CSS Grid به سطرِ بعد می‌برد.
 */
export function groupBlockRows(items = [], getWidth = blockWidth) {
  const rows = [];
  for (const item of items) {
    if (getWidth(item) === "full") {
      rows.push({ sized: false, blocks: [item] });
      continue;
    }
    const last = rows[rows.length - 1];
    if (last && last.sized) last.blocks.push(item);
    else rows.push({ sized: true, blocks: [item] });
  }
  return rows;
}
