/**
 * src/lib/racketMatch/questions.js
 *
 * واژگانِ مشترکِ پرسش‌ها بین رابط کاربری و موتور پیشنهاد.
 * متنِ گزینه‌ها عمداً غیرفنی است (§30): بازیکن نباید بداند «وزن سویینگ» یا «RA»
 * چیست؛ او تجربهٔ خودش را توصیف می‌کند و موتور آن را به مشخصات فنی ترجمه می‌کند.
 */

export const PRIORITY_KEYS = [
  "power",
  "control",
  "spin",
  "maneuverability",
  "stability",
  "comfort",
  "forgiveness",
];

export const PRIORITY_LABELS = {
  power: "قدرت",
  control: "کنترل",
  spin: "اسپین",
  maneuverability: "چابکی",
  stability: "پایداری",
  comfort: "راحتی",
  forgiveness: "بخشندگی",
};

export const STYLE_LABELS = {
  power: "قدرتی",
  spin: "اسپین‌محور",
  control: "کنترلی",
  "all-court": "همه‌کاره",
};

export const LEVEL_LABELS = {
  beginner: "مبتدی",
  intermediate: "متوسط",
  advanced: "پیشرفته",
};

/** بازخوردِ ساختاریافته دربارهٔ راکت فعلی — هر گزینه به یک اصلاحِ مشخص در §17 نگاشت می‌شود */
export const CURRENT_FEEDBACK_KEYS = [
  "too-heavy",
  "not-enough-power",
  "too-powerful",
  "unstable",
  "want-more-spin",
  "uncomfortable",
];

/**
 * تعریفِ گام‌های پرسشنامه. هر گام یک شناسه، عنوان فارسی و مجموعه گزینه دارد.
 * `multi` یعنی چندانتخابی، `optional` یعنی می‌توان از آن گذشت.
 */
export const STEPS = [
  {
    id: "age",
    title: "سن شما",
    hint: "برای بازیکنان کم‌سن، اندازهٔ راکت قاعدهٔ متفاوتی دارد.",
    options: [
      { value: "under10", label: "زیر ۱۰ سال" },
      { value: "10to13", label: "۱۰ تا ۱۳ سال" },
      { value: "14to17", label: "۱۴ تا ۱۷ سال" },
      { value: "adult", label: "۱۸ سال به بالا" },
    ],
  },
  {
    id: "height",
    title: "قد بازیکن",
    hint: "برای انتخاب طول درستِ راکت کودک و نوجوان لازم است.",
    // فقط وقتی سن، جونیور باشد پرسیده می‌شود
    when: (answers) => answers.age && answers.age !== "adult",
    options: [
      { value: "under120", label: "کمتر از ۱۲۰ سانتی‌متر" },
      { value: "120to135", label: "۱۲۰ تا ۱۳۵ سانتی‌متر" },
      { value: "135to150", label: "۱۳۵ تا ۱۵۰ سانتی‌متر" },
      { value: "150to165", label: "۱۵۰ تا ۱۶۵ سانتی‌متر" },
      { value: "over165", label: "بیشتر از ۱۶۵ سانتی‌متر" },
    ],
  },
  {
    id: "level",
    title: "بازی امروزتان را چطور توصیف می‌کنید؟",
    hint: "به‌جای برچسبِ سطح، همان چیزی را انتخاب کنید که واقعاً در زمین اتفاق می‌افتد.",
    options: [
      { value: "new", label: "تازه شروع کرده‌ام" },
      { value: "rally", label: "رَلی می‌زنم اما هنوز ضربه‌هایم یکدست نیست" },
      { value: "consistent", label: "از ته زمین یکدست رَلی می‌زنم و توپ را کنترل می‌کنم" },
      { value: "fullswing", label: "مرتب بازی می‌کنم و ضربهٔ کاملی دارم" },
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
      { value: "power", label: "قدرتی — دنبال ضربهٔ سنگین و عمق زمین" },
      { value: "spin", label: "اسپین‌محور — با چرخش زیاد بازی می‌کنم" },
      { value: "control", label: "کنترلی — دقت و جای‌گذاری برایم مهم‌تر است" },
      { value: "all-court", label: "همه‌کاره — هم ته زمین، هم جلوی تور" },
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
      { value: "not-enough-power", label: "قدرت کافی به توپ نمی‌دهد" },
      { value: "too-powerful", label: "توپ زیادی می‌رود و از زمین بیرون می‌زند" },
      { value: "unstable", label: "مقابل ضربه‌های سنگین بی‌ثبات است" },
      { value: "want-more-spin", label: "اسپین بیشتری می‌خواهم" },
      { value: "uncomfortable", label: "دست و آرنجم اذیت می‌شود" },
    ],
  },
  {
    id: "grip",
    title: "شمارهٔ گریپ (دسته) شما",
    hint: "اگر نمی‌دانید، گزینهٔ آخر را بزنید تا راهنمای اندازه‌گیری دست را ببینید.",
    options: [
      { value: "L0", label: "L0" },
      { value: "L1", label: "L1" },
      { value: "L2", label: "L2" },
      { value: "L3", label: "L3" },
      { value: "L4", label: "L4" },
      { value: "L5", label: "L5" },
      { value: "unknown", label: "نمی‌دانم" },
    ],
  },
  {
    id: "priceRange",
    title: "بودجهٔ شما",
    hint: "بازهٔ قیمتی به‌عنوان یک شرطِ قطعی روی نتایج اعمال می‌شود.",
    optional: true,
    type: "price-range",
  },
];

/** گام‌هایی که با توجه به پاسخ‌های فعلی باید نمایش داده شوند (§26 — پرسشِ اضافه نپرس) */
export function visibleSteps(answers = {}) {
  return STEPS.filter((step) => (step.when ? step.when(answers) : true));
}

/* ═══════════════════════ §29 سطح اطمینان ═══════════════════════ */

/**
 * این بخش عمداً این‌جاست و نه در engine.js: رابط کاربری هم باید بداند «آیا
 * اطلاعات برای اولین پیشنهاد کافی است؟» و اگر engine را import کند، کلِ منطقِ
 * امتیازدهی هم به باندلِ کلاینت می‌رود — دقیقاً چیزی که نمی‌خواهیم.
 */

/** پرسش‌های پرتأثیر، به ترتیبِ اهمیت برای بالا بردن اطمینان */
const HIGH_IMPACT = ["level", "swingSpeed", "style", "strength", "grip"];

const MISSING_PROMPT = {
  level: "برای دقیق‌تر شدن پیشنهاد، بگویید بازی امروزتان را چطور توصیف می‌کنید.",
  swingSpeed: "برای دقیق‌تر شدن پیشنهاد، سرعت ضربه‌تان را مشخص کنید.",
  style: "برای دقیق‌تر شدن پیشنهاد، سبک بازی‌تان را انتخاب کنید.",
  strength: "برای دقیق‌تر شدن پیشنهاد، توان بدنی‌تان را مشخص کنید.",
  grip: "برای دقیق‌تر شدن پیشنهاد، شمارهٔ گریپتان را انتخاب کنید.",
};

/**
 * §29 — سطح اطمینان. وقتی «کم» است، رابط کاربری همان یک پرسشِ کلیدی را پیش
 * می‌کشد، نه اینکه بی‌سروصدا حدس بزند.
 */
export function assessConfidence(answers = {}) {
  const answered = HIGH_IMPACT.filter((key) => {
    const value = answers[key];
    return value !== undefined && value !== null && value !== "" && value !== "unknown";
  });
  const missing = HIGH_IMPACT.filter((key) => !answered.includes(key));

  let level = "low";
  if (answered.length >= 4) level = "high";
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
