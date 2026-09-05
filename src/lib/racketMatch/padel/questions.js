/**
 * src/lib/racketMatch/padel/questions.js
 *
 * واژگانِ مشترکِ پرسش‌های پدل بین رابط کاربری و موتور پیشنهاد — هم‌ارزِ
 * questions.js تنیس و با همان قراردادها (شناسه، `multi`، `optional`، `when`).
 *
 * متنِ گزینه‌ها عمداً غیرفنی است: بازیکن نباید بداند «بالانس» یا «هستهٔ EVA»
 * چیست؛ او تجربهٔ خودش را توصیف می‌کند و موتور آن را به مشخصات فنی ترجمه
 * می‌کند. هیچ‌جا از کاربر پرسیده نمی‌شود «بالانس پایین می‌خواهی؟».
 */

export const PRIORITY_KEYS = [
  "power",
  "control",
  "maneuverability",
  "stability",
  "comfort",
  "forgiveness",
  "spin",
];

export const PRIORITY_LABELS = {
  power: "قدرت",
  control: "کنترل",
  maneuverability: "چابکی",
  stability: "پایداری",
  comfort: "راحتی",
  forgiveness: "بخشندگی",
  spin: "اسپین",
};

export const STYLE_LABELS = {
  control: "دفاعی و کنترلی",
  "all-round": "همه‌کاره",
  aggressive: "تهاجمی",
  power: "قدرتی",
  unknown: "هنوز نمی‌دانم",
};

export const LEVEL_LABELS = {
  beginner: "مبتدی",
  intermediate: "متوسط",
  advanced: "پیشرفته",
};

/**
 * بازخوردِ ساختاریافته دربارهٔ راکت فعلی. هر گزینه به یک اصلاحِ مشخص در
 * پروفایلِ هدف نگاشت می‌شود (§50 سندِ مرجع) — نه به یک جملهٔ تزئینی.
 */
export const CURRENT_FEEDBACK_KEYS = [
  "too-heavy",
  "hard-to-control",
  "not-enough-power",
  "unstable",
  "too-stiff",
  "want-more-spin",
];

/** تعریفِ گام‌های پرسشنامهٔ پدل */
export const STEPS = [
  {
    id: "age",
    title: "سن شما",
    hint: "سن روی وزنِ قابل‌کنترل و میزانِ اهمیتِ راحتیِ ضربه اثر دارد.",
    options: [
      { value: "under14", label: "زیر ۱۴ سال" },
      { value: "14to17", label: "۱۴ تا ۱۷ سال" },
      { value: "adult", label: "۱۸ تا ۴۹ سال" },
      { value: "over50", label: "۵۰ سال به بالا" },
    ],
  },
  {
    id: "level",
    title: "بازی امروزتان را چطور توصیف می‌کنید؟",
    hint: "به‌جای برچسبِ سطح، همان چیزی را انتخاب کنید که واقعاً در زمین اتفاق می‌افتد.",
    options: [
      { value: "new", label: "تازه شروع کرده‌ام" },
      { value: "rally", label: "رَلی می‌زنم اما هنوز ضربه‌هایم یکدست نیست" },
      { value: "consistent", label: "ضربه‌هایم یکدست است و از دیوار استفاده می‌کنم" },
      { value: "tactical", label: "مرتب بازی می‌کنم و جای‌گیری و بازیِ تور را بلدم" },
      { value: "competitive", label: "در مسابقه بازی می‌کنم" },
      { value: "expert", label: "تکنیک پیشرفته دارم و خودم قدرت و اسپین می‌سازم" },
    ],
  },
  {
    id: "strength",
    title: "توان بدنی‌تان برای چرخاندن راکت",
    hint: "این پاسخ تعیین می‌کند چه وزنی را می‌توانید تا پایان بازی کنترل کنید.",
    options: [
      { value: "below", label: "کمتر از حد متوسط" },
      { value: "average", label: "متوسط" },
      { value: "athletic", label: "ورزشکارم و بدن آماده‌ای دارم" },
      { value: "strong", label: "قوی" },
      { value: "verystrong", label: "بسیار قوی" },
    ],
  },
  {
    id: "swingSpeed",
    title: "ضربه‌تان را چطور می‌زنید؟",
    options: [
      { value: "slow", label: "آرام و کوتاه" },
      { value: "moderate", label: "متوسط" },
      { value: "fast", label: "سریع و کامل" },
      { value: "veryfast", label: "بسیار سریع و انفجاری" },
    ],
  },
  {
    id: "style",
    title: "سبک بازی‌تان",
    options: [
      { value: "control", label: "دفاعی — توپ را برمی‌گردانم و منتظر خطای حریف می‌مانم" },
      { value: "all-round", label: "همه‌کاره — هم دفاع می‌کنم هم به تور می‌آیم" },
      { value: "aggressive", label: "تهاجمی — جلو می‌روم و امتیاز را خودم تمام می‌کنم" },
      { value: "power", label: "قدرتی — دنبال اسمشِ سنگین و ضربهٔ تمام‌کننده‌ام" },
      { value: "unknown", label: "هنوز نمی‌دانم" },
    ],
  },
  {
    id: "priorities",
    title: "مهم‌ترین چیزها برایتان (به ترتیب اهمیت)",
    hint: "حداکثر سه مورد. ترتیب انتخاب، همان ترتیب اهمیت است.",
    multi: true,
    max: 3,
    options: PRIORITY_KEYS.map((key) => ({ value: key, label: PRIORITY_LABELS[key] })),
  },
  {
    id: "currentRacket",
    title: "راکت فعلی شما",
    hint: "اگر راکت فعلی‌تان را وارد کنید، پیشنهاد را دقیقاً نسبت به همان می‌سنجیم.",
    optional: true,
    type: "product-search",
  },
  {
    id: "currentFeedback",
    title: "دربارهٔ راکت فعلی‌تان چه چیزی آزارتان می‌دهد؟",
    hint: "هر چند مورد که درست است.",
    optional: true,
    multi: true,
    when: (answers) => Boolean(answers.currentRacket),
    options: [
      { value: "too-heavy", label: "چرخاندنش سخت است / خیلی سنگین است" },
      { value: "hard-to-control", label: "مهار کردنش سخت است و توپ کج می‌رود" },
      { value: "not-enough-power", label: "قدرت کافی به توپ نمی‌دهد" },
      { value: "unstable", label: "مقابل ضربه‌های سنگین بی‌ثبات است" },
      { value: "too-stiff", label: "حسش خشک است و دست و آرنجم اذیت می‌شود" },
      { value: "want-more-spin", label: "اسپین بیشتری می‌خواهم" },
    ],
  },
  {
    id: "priceRange",
    title: "بودجهٔ شما",
    hint: "دو سرِ اسلایدر را جابه‌جا کنید. دامنه، کف و سقفِ قیمتِ راکت‌های موجود است.",
    optional: true,
    type: "price-range",
  },
];

/** گام‌هایی که با توجه به پاسخ‌های فعلی باید نمایش داده شوند */
export function visibleSteps(answers = {}) {
  return STEPS.filter((step) => (step.when ? step.when(answers) : true));
}

/* ═══════════════════════ سطح اطمینان ═══════════════════════ */

/**
 * مثل تنیس، این بخش عمداً این‌جاست و نه در engine.js: رابط کاربری هم باید بداند
 * «آیا اطلاعات برای اولین پیشنهاد کافی است؟» و اگر engine را import کند، کلِ
 * منطقِ امتیازدهی هم به باندلِ کلاینت می‌رود.
 */

/** پرسش‌های پرتأثیر، به ترتیبِ اهمیت برای بالا بردن اطمینان */
const HIGH_IMPACT = ["level", "swingSpeed", "style", "strength"];

const MISSING_PROMPT = {
  level: "برای دقیق‌تر شدن پیشنهاد، بگویید بازی امروزتان را چطور توصیف می‌کنید.",
  swingSpeed: "برای دقیق‌تر شدن پیشنهاد، سرعت ضربه‌تان را مشخص کنید.",
  style: "برای دقیق‌تر شدن پیشنهاد، سبک بازی‌تان را انتخاب کنید.",
  strength: "برای دقیق‌تر شدن پیشنهاد، توان بدنی‌تان را مشخص کنید.",
};

/**
 * سطح اطمینان. وقتی «کم» است، رابط کاربری همان یک پرسشِ کلیدی را پیش می‌کشد،
 * نه اینکه بی‌سروصدا حدس بزند.
 *
 * «هنوز نمی‌دانم» در سبکِ بازی عمداً مثل بی‌پاسخ حساب می‌شود: موتور آن را
 * همه‌کاره فرض می‌کند تا نتیجه بدهد، ولی اطمینان بالا نمی‌رود و کاربر همان
 * پرسش را دوباره می‌بیند.
 */
export function assessConfidence(answers = {}) {
  const answered = HIGH_IMPACT.filter((key) => {
    const value = answers[key];
    return value !== undefined && value !== null && value !== "" && value !== "unknown";
  });
  const missing = HIGH_IMPACT.filter((key) => !answered.includes(key));

  let level = "low";
  if (answered.length >= HIGH_IMPACT.length) level = "high";
  else if (answered.includes("level") && answered.length >= 2) level = "medium";

  return {
    level,
    missing,
    prompt: level === "high" ? null : (MISSING_PROMPT[missing[0]] ?? null),
  };
}

/** آیا اطلاعات برای نمایشِ یک پیشنهادِ اولیه کافی است؟ */
export function hasEnoughForPreview(answers = {}) {
  return assessConfidence(answers).level !== "low";
}
