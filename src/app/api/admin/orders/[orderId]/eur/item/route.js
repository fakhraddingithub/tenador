/**
 * src/app/api/admin/orders/[orderId]/eur/item/route.js
 *
 * قیمت یورویی (EUR) یکی از اقلامِ یک سفارش — کاملاً مستقل از سیستم تومان.
 *
 * PATCH → تنظیم/ویرایش/پاک‌کردنِ items[].priceEUR برای یک قلم، و سپس بازمحاسبه‌ی
 *         مبلغ کلِ یوروییِ سفارش (order.priceEUR) از روی مجموعِ اقلام.
 *
 * این مسیر فقط دو فیلد را می‌نویسد:
 *   - items.$.priceEUR  (قیمتِ واحدِ یوروییِ همان قلم)
 *   - priceEUR          (مبلغ کلِ یوروییِ سفارش، فقط اگر دست‌کم یک قلم قیمت دارد)
 *
 * هیچ فیلد تومانی (unitPrice / totalPrice / subtotalPrice / discountAmount /
 * couponDiscount / paymentStatus / payments) و هیچ webhook یا اعلانی لمس نمی‌شود.
 *
 * ⚠️ نکته‌ی مهم درباره‌ی نوشتن داده — دقیقاً همان دلیلِ مستندشده در
 * `../route.js`: از updateOne اتمیک با { strict: false } استفاده می‌کنیم، چون در
 * حالت توسعه Next.js با HMR ماژول‌ها را دوباره اجرا می‌کند ولی مدلِ کش‌شده‌ی
 * Mongoose (mongoose.models.Order) ممکن است اسکیمای قدیمیِ بدون این فیلد را نگه
 * دارد؛ آنگاه order.save() با strict:true فیلد ناشناخته را بی‌صدا حذف می‌کرد
 * (پاسخ ۲۰۰ ولی بدون ذخیره).
 *
 * ⚠️ چرا عملگرِ موقعیتیِ `items.$` و نه arrayFilters: طبق تجربه‌ی مستندشده در
 * PUT همان فایل، arrayFilters روی مدلِ کش‌شده‌ی HMR با strict:false قابل‌اتکا
 * اعمال نمی‌شد (سند match می‌شد ولی چیزی نوشته نمی‌شد). `items.$` یک مسیرِ ساده
 * است و این مشکل را ندارد. ضمناً برخلافِ read-modify-write روی کلِ آرایه،
 * فقط همان یک فیلد را می‌نویسد و ویرایش‌های هم‌زمانِ بقیه‌ی اقلام را از بین نمی‌برد.
 */

import { NextResponse } from "next/server";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Order from "base/models/Order";

import { sumItemsEUR } from "base/services/orderEurRecalc";
import requireAdminPermission from "@/lib/requireAdminPermission";

const isId = (v) => v && mongoose.Types.ObjectId.isValid(v);

/**
 * خروجی استاندارد بخش یورو برای کلاینت — با خواندن lean (مستقل از اسکیمای کش‌شده).
 * علاوه بر مقادیرِ سطحِ سفارش، قیمت یوروییِ هر قلم را هم برمی‌گرداند تا UI بدون
 * یک fetch اضافه به‌روز شود.
 */
async function eurPayload(orderId) {
  const order = await Order.findById(orderId).lean();
  const paymentsEUR = order?.paymentsEUR || [];
  const totalPaidEUR = paymentsEUR.reduce((s, p) => s + (p.amount || 0), 0);
  const priceEUR = order?.priceEUR ?? null;
  const remainingEUR = priceEUR === null ? null : priceEUR - totalPaidEUR;
  const { sum: itemsTotalEUR, hasAny: hasItemEurPrices } = sumItemsEUR(order?.items);

  return {
    priceEUR,
    paymentsEUR,
    totalPaidEUR,
    remainingEUR,
    itemsTotalEUR,
    hasItemEurPrices,
    itemsEUR: (order?.items || []).map((it) => ({
      _id: String(it._id),
      priceEUR: it.priceEUR ?? null,
    })),
  };
}

/* ─── PATCH: تنظیم قیمت یورویی یک قلم + بازمحاسبه‌ی مبلغ کل یورو ──────── */
export async function PATCH(req, { params }) {
  // همان کلیدی که کلِ سیستم یورو با آن گیت شده است — بدون افزودن کلید جدید،
  // تا دسترسی‌های تعریف‌شده‌ی فعلیِ ادمین‌ها بدون تغییر کار کند.
  const { denied } = await requireAdminPermission("orders.setCurrency");
  if (denied) return denied;

  try {
    await connectToDB();

    const { orderId } = await params;
    if (!isId(orderId)) {
      return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    }

    const body = await req.json();
    const { itemId, priceEUR } = body;

    if (!isId(itemId)) {
      return NextResponse.json({ message: "شناسه آیتم نامعتبر است" }, { status: 400 });
    }

    // اجازه‌ی پاک کردن قیمت با null یا رشته‌ی خالی — عیناً مثل قیمت یوروییِ سفارش
    let value = null;
    if (priceEUR !== null && priceEUR !== undefined && priceEUR !== "") {
      const parsed = Number(priceEUR);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return NextResponse.json(
          { message: "قیمت یورو باید عددی نامنفی باشد" },
          { status: 400 }
        );
      }
      // یورو ارزِ اعشاری است: تا دو رقم اعشار نگه می‌داریم (مثل خودِ مبلغ کل)
      value = Math.round(parsed * 100) / 100;
    }

    // ۱) نوشتنِ اتمیکِ قیمتِ همان قلم. فیلترِ روی items._id تضمین می‌کند عملگرِ
    //    موقعیتیِ `$` دقیقاً به همان قلم اشاره کند.
    const itemResult = await Order.updateOne(
      { _id: orderId, "items._id": new mongoose.Types.ObjectId(itemId) },
      { $set: { "items.$.priceEUR": value } },
      { strict: false }
    );

    if (itemResult.matchedCount === 0) {
      // یا سفارش نیست یا آن قلم داخلش نیست — از هم تفکیک می‌کنیم تا پیام دقیق باشد
      const exists = await Order.exists({ _id: orderId });
      return NextResponse.json(
        { message: exists ? "آیتم در سفارش یافت نشد" : "سفارش یافت نشد" },
        { status: 404 }
      );
    }

    // ۲) بازمحاسبه‌ی مبلغ کلِ یورو از روی وضعیتِ **تازه‌خوانده‌شده‌ی** اقلام.
    //    عمداً بعد از نوشتنِ قلم می‌خوانیم (نه قبلش) تا با ویرایش‌های هم‌زمانِ
    //    اقلامِ دیگر هم مجموع درست دربیاید.
    const fresh = await Order.findById(orderId).select("items priceEUR").lean();
    const { hasAny, sum } = sumItemsEUR(fresh?.items);

    // اگر هیچ قلمی قیمت یورویی ندارد، مبلغ کل دست‌نخورده می‌ماند (سازگاری با
    // سفارش‌های قدیمی: مبلغ کلِ دستی هرگز خودبه‌خود صفر/پاک نمی‌شود).
    if (hasAny && (fresh?.priceEUR ?? null) !== sum) {
      await Order.updateOne(
        { _id: orderId },
        { $set: { priceEUR: sum } },
        { strict: false }
      );
    }

    return NextResponse.json(
      {
        message: value === null ? "قیمت یورویی آیتم حذف شد" : "قیمت یورویی آیتم ذخیره شد",
        ...(await eurPayload(orderId)),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id/eur/item PATCH]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
