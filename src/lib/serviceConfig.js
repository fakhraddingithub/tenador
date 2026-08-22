/**
 * src/lib/serviceConfig.js
 *
 * منبعِ واحدِ حقیقت برای «پیکربندیِ خدمت» (service options).
 * ماژول خالص (بدون I/O) تا هم در سرور (priceEngine / checkout) و هم در کلاینت
 * (پیش‌نمایشِ قیمت در مودال) استفاده شود؛ در نتیجه قیمت در همه‌جا یکسان است.
 *
 * ─── ساختارِ تعریفِ آپشن (روی نودِ نوع service) ───
 *  node.options: [{
 *    key, title, description, inputType: "choice" | "range", required, image,
 *    choices: [{ key, label, priceModifier, image }],            // choice
 *    range:   { min, max, step, unit, basePrice, pricePerStep }  // range
 *  }]
 *
 * ─── سازگاریِ عقب‌رو ───
 *  نودهای قدیمی فقط node.serviceOptions = [{label, value, priceModifier}] دارند.
 *  این ماژول آن‌ها را به یک آپشنِ choice با کلیدِ LEGACY_OPTION_KEY نرمال می‌کند،
 *  بنابراین مسیرِ کد یکی است و سبدها/سفارش‌های قدیمی دست‌نخورده کار می‌کنند.
 *
 * ─── شکلِ انتخابِ مشتری (سبد → چک‌اوت) ───
 *  { nodeId, nodeType:"service", nodeLabel, serviceName,
 *    serviceConfig: [{ optionKey, choiceKey? , value? }] }
 *  قیمت‌ها هرگز از کلاینت خوانده نمی‌شوند.
 */

export const SERVICE_INPUT_TYPES = ["choice", "range"];
export const LEGACY_OPTION_KEY = "__legacy";

/**
 * کلیدِ ردیفِ «هزینه‌ی خودِ خدمت» (node.servicePrice).
 * یک آپشنِ واقعی نیست: ورودیِ کاربر ندارد و هرگز از کلاینت خوانده نمی‌شود؛
 * فقط یک ردیفِ نمایشی/اسنپ‌شاتی است که سرور خودش می‌سازد تا سبد، سفارش و
 * ایمیل بدونِ کدِ اضافه آن را نشان دهند.
 */
export const SERVICE_FEE_KEY = "__serviceFee";

/** آیا این ردیفِ پیکربندی، هزینه‌ی خودِ خدمت است (نه انتخابِ کاربر)؟ */
export function isServiceFeeEntry(entry) {
  return String(entry?.optionKey) === SERVICE_FEE_KEY;
}

const EPS = 1e-6;

/** عددِ خوانا بدون صفرهای اضافی: 24.50 → "24.5" ، 24.0 → "24" */
export function formatNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return String(Math.round(v * 1e6) / 1e6);
}

/** برچسبِ نمایشیِ یک مقدارِ range همراه واحد */
export function rangeLabel(value, unit) {
  const num = formatNum(value);
  return unit ? `${num} ${unit}` : num;
}

/** آیا مقدار روی گام‌های تعریف‌شده می‌نشیند؟ (اعشار-امن) */
export function isOnStep(value, min, step) {
  const s = Number(step);
  if (!Number.isFinite(s) || s <= 0) return true; // گامِ نامعتبر → هر مقداری در بازه مجاز
  const steps = (Number(value) - Number(min)) / s;
  return Math.abs(steps - Math.round(steps)) < EPS;
}

/** تعدادِ گام‌های بالاتر از min (برای قیمتِ پلکانیِ range) */
function stepCount(value, min, step) {
  const s = Number(step);
  if (!Number.isFinite(s) || s <= 0) return 0;
  return Math.round((Number(value) - Number(min)) / s);
}

function normRange(range) {
  const r = range || {};
  const defaultValue = Number(r.defaultValue);
  return {
    min: Number(r.min) || 0,
    max: Number(r.max) || 0,
    step: Number(r.step) > 0 ? Number(r.step) : 1,
    unit: typeof r.unit === "string" ? r.unit : "",
    basePrice: Number(r.basePrice) || 0,
    pricePerStep: Number(r.pricePerStep) || 0,
    // null یعنی ادمین مقدارِ پیش‌فرض تعیین نکرده (آپشن‌های قبل از این قابلیت)
    defaultValue:
      r.defaultValue == null || r.defaultValue === "" || !Number.isFinite(defaultValue)
        ? null
        : defaultValue,
  };
}

/**
 * مقدارِ اولیه‌ی یک آپشنِ بازه‌ای — چیزی که مشتری بدونِ دست‌زدن به اسلایدر دارد.
 *
 * آپشنِ بازه‌ای همیشه (و بدونِ تاییدِ جداگانه‌ی مشتری) بخشی از خدمت است، پس
 * همیشه یک مقدار دارد. اگر ادمین مقدارِ پیش‌فرض تعیین نکرده باشد — یا دادهٔ
 * ذخیره‌شده‌ی قدیمی نامعتبر باشد — به کمینه برمی‌گردیم که همیشه معتبر است.
 */
export function rangeDefaultValue(option) {
  const r = normRange(option?.range);
  const d = r.defaultValue;
  if (d === null) return r.min;
  if (d < r.min - EPS || d > r.max + EPS || !isOnStep(d, r.min, r.step)) return r.min;
  return d;
}

/**
 * آپشن‌های یک نودِ خدمت — با نرمال‌سازیِ دادهٔ قدیمی.
 * همیشه آرایه برمی‌گرداند (شاید خالی).
 */
export function getServiceOptions(node) {
  const v2 = Array.isArray(node?.options) ? node.options : [];
  if (v2.length > 0) {
    return v2.map((o, i) => ({
      key: String(o?.key || `opt-${i}`),
      // عنوانِ خالی هرگز نباید به نامِ نوعِ ورودی («بازه‌ای»/Range) برگردد؛
      // مشتری باید نامِ معنادارِ خدمت را ببیند، نه اصطلاحِ فنیِ داخلی.
      title: o?.title || node?.serviceName || node?.label || "",
      description: o?.description || "",
      inputType: SERVICE_INPUT_TYPES.includes(o?.inputType) ? o.inputType : "choice",
      required: Boolean(o?.required),
      image: o?.image || null,
      choices: (Array.isArray(o?.choices) ? o.choices : []).map((c, j) => ({
        key: String(c?.key || `c-${j}`),
        label: c?.label || "",
        priceModifier: Number(c?.priceModifier) || 0,
        image: c?.image || null,
      })),
      range: normRange(o?.range),
    }));
  }

  // دادهٔ قدیمی: خودِ نود یک آپشنِ تک‌انتخابی بوده است
  const legacy = Array.isArray(node?.serviceOptions) ? node.serviceOptions : [];
  if (legacy.length === 0) return [];
  return [
    {
      key: LEGACY_OPTION_KEY,
      title: node?.label || node?.serviceName || "",
      description: "",
      inputType: "choice",
      required: Boolean(node?.required),
      image: null,
      choices: legacy.map((o, j) => ({
        key: String(o?.value ?? `c-${j}`),
        label: o?.label || String(o?.value ?? ""),
        priceModifier: Number(o?.priceModifier) || 0,
        image: null,
      })),
      range: normRange(null),
    },
  ];
}

/**
 * انتخاب‌های خامِ کلاینت را به شکلِ یکدستِ [{optionKey, choiceKey?, value?}] تبدیل می‌کند.
 * شکلِ قدیمیِ سبد ({ serviceOption: { value } }) هم پشتیبانی می‌شود.
 */
export function normalizeRawSelection(sel) {
  if (Array.isArray(sel?.serviceConfig)) {
    return sel.serviceConfig
      // ردیفِ هزینه‌ی خدمت ورودیِ کاربر نیست؛ سرور خودش دوباره می‌سازدش.
      .filter((c) => c && c.optionKey != null && !isServiceFeeEntry(c))
      .map((c) => ({
        optionKey: String(c.optionKey),
        ...(c.choiceKey != null ? { choiceKey: String(c.choiceKey) } : {}),
        ...(c.value != null && c.value !== "" ? { value: Number(c.value) } : {}),
      }));
  }
  if (sel?.serviceOption?.value != null) {
    return [
      { optionKey: LEGACY_OPTION_KEY, choiceKey: String(sel.serviceOption.value) },
    ];
  }
  return [];
}

/**
 * اعتبارسنجی + قیمت‌گذاریِ یک آپشن بر اساس انتخابِ خام.
 * @returns {{ entry: Object|null, error: string|null }}
 */
export function resolveOption(option, raw) {
  if (option.inputType === "range") {
    const { min, max, step, unit, basePrice, pricePerStep } = option.range;
    const value = Number(raw?.value);
    if (!Number.isFinite(value)) {
      return { entry: null, error: `مقدارِ «${option.title}» نامعتبر است` };
    }
    if (value < min - EPS || value > max + EPS) {
      return {
        entry: null,
        error: `مقدارِ «${option.title}» باید بین ${formatNum(min)} و ${formatNum(max)} باشد`,
      };
    }
    if (!isOnStep(value, min, step)) {
      return {
        entry: null,
        error: `مقدارِ «${option.title}» باید مضربی از ${formatNum(step)} باشد`,
      };
    }
    const priceModifier = Math.round(
      basePrice + pricePerStep * stepCount(value, min, step)
    );
    return {
      error: null,
      entry: {
        optionKey: option.key,
        title: option.title,
        inputType: "range",
        value,
        unit,
        label: rangeLabel(value, unit),
        image: option.image || null,
        priceModifier,
      },
    };
  }

  // choice
  const choice = option.choices.find((c) => c.key === String(raw?.choiceKey));
  if (!choice) {
    return { entry: null, error: `گزینه‌ی انتخاب‌شده برای «${option.title}» معتبر نیست` };
  }
  return {
    error: null,
    entry: {
      optionKey: option.key,
      title: option.title,
      inputType: "choice",
      choiceKey: choice.key,
      label: choice.label,
      image: choice.image || option.image || null,
      priceModifier: choice.priceModifier,
    },
  };
}

/**
 * حلِ کاملِ یک نودِ خدمت — تنها مرجعِ قیمت و اعتبارسنجی.
 *
 * @param {Object} node نودِ خدمت از تعریفِ فعلیِ فرایند (یا null اگر پیدا نشد)
 * @param {Object} sel  انتخابِ خامِ کلاینت
 * @returns {{ addonToman:number, config:Object[], errors:string[] }}
 */
export function resolveServiceSelection(node, sel) {
  const errors = [];
  if (!node) {
    return {
      addonToman: 0,
      config: [],
      errors: ["مرحله‌ی خدمت دیگر در فرایند وجود ندارد"],
    };
  }

  const options = getServiceOptions(node);
  const optionMap = new Map(options.map((o) => [o.key, o]));
  const raws = normalizeRawSelection(sel);
  const seen = new Set();
  const config = [];
  let addonToman = 0;

  for (const raw of raws) {
    if (seen.has(raw.optionKey)) continue; // انتخابِ تکراری نادیده گرفته می‌شود
    const option = optionMap.get(raw.optionKey);
    if (!option) {
      errors.push("یکی از آپشن‌های انتخاب‌شده به این خدمت تعلق ندارد");
      continue;
    }
    seen.add(raw.optionKey);
    const { entry, error } = resolveOption(option, raw);
    if (error) {
      errors.push(error);
      continue;
    }
    config.push(entry);
    addonToman += entry.priceModifier;
  }

  // آیا این خدمت واقعاً بخشی از سفارش است؟
  //   • مرحله‌ی اجباری  → همیشه (حتی اگر کلاینت چیزی نفرستد)
  //   • مرحله‌ی اختیاری → فقط وقتی مشتری چیزی انتخاب کرده باشد
  // بدونِ این تفکیک، یک مرحله‌ی اختیاریِ دست‌نخورده هزینه‌ی خدمت می‌گرفت.
  const active = Boolean(node.required) || config.length > 0;

  if (active) {
    // آپشنِ بازه‌ای همیشه با مقدارِ پیش‌فرضش اعمال می‌شود، حتی اگر کلاینت
    // نفرستدش. پس نه با کلاینتِ دستکاری‌شده قابلِ دور زدن است و نه دوبار حساب
    // می‌شود، چون seen جلوی تکرار را می‌گیرد.
    for (const option of options) {
      if (seen.has(option.key) || option.inputType !== "range") continue;
      const { entry } = resolveOption(option, { value: rangeDefaultValue(option) });
      if (!entry) continue;
      seen.add(option.key);
      config.push(entry);
      addonToman += entry.priceModifier;
    }

    // هزینه‌ی خودِ خدمت — نیازی به ساختنِ یک آپشنِ ساختگی برای قیمت‌گذاری نیست
    const servicePrice = Math.round(Number(node.servicePrice) || 0);
    if (servicePrice !== 0) {
      config.unshift({
        optionKey: SERVICE_FEE_KEY,
        title: node.serviceName || node.label || "خدمت",
        inputType: "fee",
        label: "هزینه‌ی خدمت",
        image: null,
        priceModifier: servicePrice,
      });
      addonToman += servicePrice;
    }
  }

  // آپشن‌های اجباریِ پیکربندی‌نشده
  for (const option of options) {
    if (option.required && !seen.has(option.key)) {
      errors.push(`انتخابِ «${option.title}» اجباری است`);
    }
  }

  return { addonToman, config, errors, active };
}

/** امضای پایدارِ یک پیکربندی — برای تشخیصِ یکسان بودنِ دو خطِ سبد */
export function serviceConfigSignature(rawSelections) {
  return (rawSelections || [])
    .map((c) => `${c.optionKey}=${c.choiceKey ?? formatNum(c.value)}`)
    .sort()
    .join(",");
}

/**
 * اعتبارسنجیِ تعریفِ آپشن‌ها هنگامِ ذخیره در پنل ادمین.
 * @returns {string[]} پیام‌های خطا (خالی = معتبر)
 */
export function validateServiceOptions(options) {
  const errors = [];
  if (!Array.isArray(options)) return errors;
  const keys = new Set();

  options.forEach((o, i) => {
    const name = o?.title?.trim() || `آپشن ${i + 1}`;
    if (!o?.key) errors.push(`${name}: شناسه‌ی آپشن خالی است`);
    else if (keys.has(String(o.key))) errors.push(`${name}: شناسه‌ی تکراری`);
    else keys.add(String(o.key));

    if (!o?.title?.trim()) errors.push(`آپشن ${i + 1}: عنوان الزامی است`);

    if (!SERVICE_INPUT_TYPES.includes(o?.inputType)) {
      errors.push(`${name}: نوعِ ورودی نامعتبر است`);
      return;
    }

    if (o.inputType === "choice") {
      const choices = Array.isArray(o.choices) ? o.choices : [];
      if (choices.length === 0) errors.push(`${name}: حداقل یک گزینه لازم است`);
      const cKeys = new Set();
      choices.forEach((c, j) => {
        if (!c?.label?.trim()) errors.push(`${name}: عنوانِ گزینه‌ی ${j + 1} خالی است`);
        if (!c?.key) errors.push(`${name}: شناسه‌ی گزینه‌ی ${j + 1} خالی است`);
        else if (cKeys.has(String(c.key))) errors.push(`${name}: شناسه‌ی گزینه‌ی تکراری`);
        else cKeys.add(String(c.key));
      });
    } else {
      const r = normRange(o.range);
      if (!(r.max > r.min)) errors.push(`${name}: بیشینه باید بزرگ‌تر از کمینه باشد`);
      if (!(Number(o?.range?.step) > 0)) errors.push(`${name}: گام باید بزرگ‌تر از صفر باشد`);

      // مقدارِ پیش‌فرض همان چیزی است که مشتری بدونِ دست‌زدن به اسلایدر سفارش
      // می‌دهد، پس نباید بتواند نامعتبر ذخیره شود. تعیین‌نشده (null) مجاز است و
      // به کمینه برمی‌گردد — تا آپشن‌های ساخته‌شده پیش از این قابلیت نشکنند.
      if (r.defaultValue !== null) {
        if (r.defaultValue < r.min - EPS || r.defaultValue > r.max + EPS) {
          errors.push(
            `${name}: مقدار پیش‌فرض باید بین ${formatNum(r.min)} و ${formatNum(r.max)} باشد`
          );
        } else if (!isOnStep(r.defaultValue, r.min, r.step)) {
          errors.push(`${name}: مقدار پیش‌فرض باید روی گام‌های ${formatNum(r.step)} بنشیند`);
        }
      }
    }
  });

  return errors;
}

/**
 * حذفِ داده‌ی بی‌ربط به نوعِ ورودی، پیش از اعتبارسنجی و ذخیره.
 *
 * ویرایشگر هر آپشنِ تازه را با یک choiceِ خالی می‌سازد (نوعِ پیش‌فرض choice است).
 * اگر ادمین نوع را به range عوض کند آن choiceِ خالی در state باقی می‌ماند —
 * عمداً، تا با برگشتن به choice کارِ ادمین از دست نرود. ولی choice برای یک
 * آپشنِ range معنایی ندارد و `label` در اسکیما required است، پس اگر ذخیره شود
 * Mongoose خطای اعتبارسنجی می‌دهد. اینجا پیش از ذخیره حذفش می‌کنیم.
 *
 * @returns {Array} کپیِ نودها با آپشن‌های پاک‌سازی‌شده
 */
export function normalizeFlowNodes(nodes) {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((node) => {
    if (node?.type !== "service") return node;
    return {
      ...node,
      // ورودیِ خالی/نامعتبرِ قیمت نباید در Mongoose به CastError و ۵۰۰ برسد.
      // نودی که اصلاً این فیلد را ندارد دست‌نخورده می‌ماند (default اسکیما = ۰).
      ...(node.servicePrice !== undefined
        ? { servicePrice: Math.round(Number(node.servicePrice) || 0) }
        : {}),
      ...(Array.isArray(node.options)
        ? {
            options: node.options.map((o) =>
              o?.inputType === "range" ? { ...o, choices: [] } : o
            ),
          }
        : {}),
    };
  });
}

/**
 * اعتبارسنجیِ نودهای یک فرایند پیش از ذخیره (مرزِ اعتماد در API ادمین).
 * نودهای قدیمی (فقط serviceOptions) نادیده گرفته می‌شوند تا ذخیره‌ی دوباره‌ی
 * فرایندهای موجود بلوکه نشود.
 * @returns {string[]}
 */
export function validateFlowNodes(nodes) {
  const errors = [];
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (node?.type !== "service") continue;
    if (!Array.isArray(node.options) || node.options.length === 0) continue;
    for (const e of validateServiceOptions(node.options)) {
      errors.push(`${node.label || "مرحله‌ی خدمت"} — ${e}`);
    }
  }
  return errors;
}
