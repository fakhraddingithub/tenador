/**
 * src/lib/quantityDiscountValidation.js
 *
 * اعتبارسنجی و نرمال‌سازی payload تخفیف تعدادی — مشترک بین روت‌های ادمین.
 */

import mongoose from "mongoose";

const VALID_TYPES = ["global", "product", "brand", "serie", "category"];

export function validateQuantityDiscountPayload(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.type !== undefined) {
    if (!body.type || !VALID_TYPES.includes(body.type)) {
      errors.push("نوع تخفیف تعدادی معتبر نیست");
    }
  }

  // برای نوع‌های غیر global، انتخاب هدف الزامی است
  if (!partial || body.targets !== undefined) {
    const type = body.type;
    if (type && type !== "global") {
      if (!Array.isArray(body.targets) || body.targets.length === 0) {
        errors.push("انتخاب حداقل یک هدف برای نوع انتخاب‌شده الزامی است");
      } else {
        for (const id of body.targets) {
          if (!mongoose.Types.ObjectId.isValid(id)) {
            errors.push("شناسه‌ی یکی از اهداف معتبر نیست");
            break;
          }
        }
      }
    }
  }

  if (!partial || body.tiers !== undefined) {
    const tiers = body.tiers;
    if (!Array.isArray(tiers) || tiers.length === 0) {
      errors.push("حداقل یک پله تخفیف تعریف کنید");
    } else {
      const seen = new Set();
      for (const t of tiers) {
        const minQty = Number(t?.minQty);
        const kind = t?.discount?.kind;
        const value = Number(t?.discount?.value);

        if (!Number.isInteger(minQty) || minQty < 2) {
          errors.push("حداقل تعداد هر پله باید عددی صحیح و حداقل ۲ باشد");
          break;
        }
        if (seen.has(minQty)) {
          errors.push("دو پله با حداقل تعداد یکسان تعریف شده است");
          break;
        }
        seen.add(minQty);

        if (!["percent", "amount"].includes(kind)) {
          errors.push("نوع تخفیف پله معتبر نیست");
          break;
        }
        if (!value || value <= 0) {
          errors.push("مقدار تخفیف هر پله باید بزرگ‌تر از صفر باشد");
          break;
        }
        if (kind === "percent" && value > 100) {
          errors.push("درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد");
          break;
        }
      }
    }
  }

  if (body.startAt && body.endAt) {
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (
      !isNaN(startAt.getTime()) &&
      !isNaN(endAt.getTime()) &&
      endAt <= startAt
    ) {
      errors.push("تاریخ پایان باید بعد از تاریخ شروع باشد");
    }
  }

  return errors;
}

export function normalizeTiers(tiers) {
  return [...tiers]
    .map((t) => ({
      minQty: Number(t.minQty),
      discount: { kind: t.discount.kind, value: Number(t.discount.value) },
    }))
    .sort((a, b) => a.minQty - b.minQty);
}
