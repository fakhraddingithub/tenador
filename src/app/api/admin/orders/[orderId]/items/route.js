/**
 * src/app/api/admin/orders/[orderId]/items/route.js
 *
 * ویرایش اقلامِ یک سفارشِ ثبت‌شده توسط ادمین (پس از ثبت سفارش).
 *
 *   POST   → افزودن یک آیتم جدید (محصول + واریانت اختیاری + تعداد)
 *   PATCH  → تغییر تعداد یک آیتم موجود
 *   DELETE → حذف یک آیتم
 *
 * اصول ایمنی:
 *  - فقط روی سیستم تومان اثر دارد. هیچ‌یک از فیلدهای یورویی (priceEUR / paymentsEUR)
 *    لمس نمی‌شوند → استقلال کامل دو ارز حفظ می‌شود.
 *  - قیمتِ آیتمِ جدید دقیقاً از همان مسیرِ ثبت سفارش (computeCartPrice در priceEngine)
 *    گرفته می‌شود؛ هیچ مسیر قیمت‌گذاری موازی‌ای ساخته نمی‌شود.
 *  - قیمتِ آیتم‌های موجود هرگز دوباره محاسبه نمی‌شود (اسنپ‌شات ثابت می‌ماند)؛ فقط
 *    مجموع‌ها از روی همان اسنپ‌شات‌ها بازجمع می‌شوند (services/orderRecalc.js).
 *  - همه‌ی نوشتن‌ها داخل یک transaction انجام می‌شوند تا با اجرای هم‌زمانِ چند
 *    اکشنِ ادمین، سند سفارش نیمه‌کاره/خراب نشود.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import "base/models/registerModels";
import Order from "base/models/Order";
import Payment from "base/models/Payment";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import User from "base/models/User";
import UsedProduct from "base/models/UsedProduct";
import { computeCartPrice } from "base/services/priceEngine";
import { recomputeOrderTotals, derivePaymentStatus } from "base/services/orderRecalc";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

const isId = (v) => v && mongoose.Types.ObjectId.isValid(v);

/**
 * مجموع پرداخت‌های تأییدشده‌ی تومانی + بازمحاسبه‌ی مبالغ و وضعیت پرداخت روی سند.
 * (روی همان session اجرا می‌شود.)
 */
async function recalcAndApply(order, session) {
  const totals = recomputeOrderTotals(order);
  order.subtotalPrice = totals.subtotalPrice;
  order.discountAmount = totals.discountAmount;
  order.couponDiscount = totals.couponDiscount;
  order.totalPrice = totals.totalPrice;

  // مجموع پرداخت‌های PAID — برای تعیین مجدد وضعیت پرداخت
  const paidPayments = await Payment.find({
    _id: { $in: order.payments || [] },
    status: "PAID",
  })
    .session(session)
    .lean();
  const totalPaid = paidPayments.reduce((s, p) => s + (p.amount || 0), 0);

  order.paymentStatus = derivePaymentStatus(totalPaid, order.totalPrice);
  // fulfillmentStatus عمداً دست‌نخورده می‌ماند — جریانِ ارسال را ادمین دستی مدیریت می‌کند.
}

/* ─── POST: افزودن آیتم جدید ─────────────────────────────────────────── */
export async function POST(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json({ message: "احراز هویت ادمین لازم است" }, { status: 401 });
    }

    const { orderId } = await params;
    if (!isId(orderId)) {
      return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    }

    const body = await req.json();
    const { productId, variantId, quantity } = body;

    if (!isId(productId)) {
      return NextResponse.json({ message: "شناسه محصول نامعتبر است" }, { status: 400 });
    }
    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      return NextResponse.json({ message: "تعداد باید عددی صحیح و حداقل ۱ باشد" }, { status: 400 });
    }

    // محصول و (در صورت وجود) واریانت باید معتبر باشند و واریانت متعلق به همین محصول باشد
    const product = await Product.findById(productId).select("_id name variants").lean();
    if (!product) {
      return NextResponse.json({ message: "محصول یافت نشد" }, { status: 404 });
    }
    if (variantId) {
      if (!isId(variantId)) {
        return NextResponse.json({ message: "شناسه واریانت نامعتبر است" }, { status: 400 });
      }
      const variant = await Variant.findById(variantId).select("_id productId").lean();
      if (!variant || String(variant.productId) !== String(productId)) {
        return NextResponse.json(
          { message: "واریانت انتخاب‌شده متعلق به این محصول نیست" },
          { status: 400 }
        );
      }
    }

    // خواندنِ اولیه فقط برای گرفتنِ کاربرِ سفارش (قیمت‌گذاری سنگین است و نباید داخل
    // تراکنش اجرا شود). سندِ نهایی دوباره داخل تراکنش و تازه خوانده می‌شود.
    const orderForUser = await Order.findById(orderId).select("user").lean();
    if (!orderForUser) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    // ─── قیمت‌گذاری از همان مسیرِ ثبت سفارش (priceEngine) با کانتکستِ کاربرِ سفارش ───
    let userCtx = null;
    try {
      const buyer = await User.findById(orderForUser.user).select("role level").lean();
      userCtx = { userId: String(orderForUser.user), role: buyer?.role, level: buyer?.level };
    } catch {
      userCtx = { userId: String(orderForUser.user) };
    }

    let priceResult;
    try {
      priceResult = await computeCartPrice(
        [{ productId: String(productId), variantId: variantId ? String(variantId) : null, quantity: qty, itemType: "product" }],
        userCtx,
        null // بدون اعمال مجددِ کوپن روی آیتمِ افزوده‌شده
      );
    } catch (err) {
      return NextResponse.json({ message: err.message || "خطا در محاسبه قیمت آیتم" }, { status: 400 });
    }

    const priced = priceResult?.items?.[0];
    if (!priced) {
      return NextResponse.json({ message: "محاسبه قیمت آیتم ناموفق بود" }, { status: 400 });
    }

    const unitPrice = Math.max(0, Math.round(priced.unitFinalPrice || priced.unitPrice || 0));
    const unitDiscount = Math.max(0, Math.round(priced.unitDiscount || 0));
    // basePriceToman طبق تعریفِ orderRecalc: قیمت واحدِ قبل از تخفیف = unitPrice + unitDiscount
    const basePriceToman = unitPrice + unitDiscount;

    if (unitPrice <= 0) {
      return NextResponse.json({ message: "قیمت محاسبه‌شده برای آیتم نامعتبر است" }, { status: 400 });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // خواندنِ تازه‌ی سند داخل تراکنش تا ویرایش‌های هم‌زمان از بین نروند
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
      }

      order.items.push({
        product: new mongoose.Types.ObjectId(productId),
        variant: variantId ? new mongoose.Types.ObjectId(variantId) : null,
        usedProduct: null,
        itemType: "product",
        quantity: qty,
        unitPrice,
        unitDiscount,
        basePriceToman,
        flowSelections: [],
      });

      order.reviewedBy = new mongoose.Types.ObjectId(admin.userId);
      order.reviewedAt = new Date();
      await recalcAndApply(order, session);
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json(
        { message: "آیتم به سفارش افزوده شد", totalPrice: order.totalPrice, paymentStatus: order.paymentStatus },
        { status: 200 }
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[admin/orders/:id/items POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─── PATCH: تغییر تعداد یک آیتم ─────────────────────────────────────── */
export async function PATCH(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json({ message: "احراز هویت ادمین لازم است" }, { status: 401 });
    }

    const { orderId } = await params;
    if (!isId(orderId)) {
      return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    }

    const body = await req.json();
    const { itemId, quantity } = body;
    if (!isId(itemId)) {
      return NextResponse.json({ message: "شناسه آیتم نامعتبر است" }, { status: 400 });
    }
    const qty = Math.floor(Number(quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      return NextResponse.json({ message: "تعداد باید عددی صحیح و حداقل ۱ باشد" }, { status: 400 });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
      }

      const item = order.items.id(itemId);
      if (!item) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ message: "آیتم در سفارش یافت نشد" }, { status: 404 });
      }

      // محصولات دست‌دوم همیشه تک‌عدد هستند
      if (item.itemType === "used_product" && qty !== 1) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: "تعداد محصول دست‌دوم قابل تغییر نیست (همیشه ۱ عدد)" },
          { status: 400 }
        );
      }

      item.quantity = qty;
      order.reviewedBy = new mongoose.Types.ObjectId(admin.userId);
      order.reviewedAt = new Date();
      await recalcAndApply(order, session);
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json(
        { message: "تعداد آیتم بروزرسانی شد", totalPrice: order.totalPrice, paymentStatus: order.paymentStatus },
        { status: 200 }
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[admin/orders/:id/items PATCH]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─── DELETE: حذف یک آیتم ────────────────────────────────────────────── */
export async function DELETE(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json({ message: "احراز هویت ادمین لازم است" }, { status: 401 });
    }

    const { orderId } = await params;
    if (!isId(orderId)) {
      return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    }

    const body = await req.json();
    const { itemId } = body;
    if (!isId(itemId)) {
      return NextResponse.json({ message: "شناسه آیتم نامعتبر است" }, { status: 400 });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
      }

      const item = order.items.id(itemId);
      if (!item) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json({ message: "آیتم در سفارش یافت نشد" }, { status: 404 });
      }

      // سفارش نباید بدون آیتم بماند
      if (order.items.length <= 1) {
        await session.abortTransaction();
        session.endSession();
        return NextResponse.json(
          { message: "حذف تنها آیتم سفارش ممکن نیست؛ حداقل یک آیتم باید باقی بماند" },
          { status: 400 }
        );
      }

      // اگر آیتمِ حذف‌شده محصولِ دست‌دوم است، رزرو آن آزاد می‌شود تا در انبار قابل
      // فروش مجدد شود (وضعیت → available و قطع ارجاع به این سفارش).
      const releasedUsedId =
        item.itemType === "used_product" && item.usedProduct ? item.usedProduct : null;

      item.deleteOne();

      if (releasedUsedId) {
        await UsedProduct.updateOne(
          { _id: releasedUsedId, order: order._id },
          { $set: { status: "available" }, $unset: { order: "" } },
          { session }
        );
      }

      order.reviewedBy = new mongoose.Types.ObjectId(admin.userId);
      order.reviewedAt = new Date();
      await recalcAndApply(order, session);
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json(
        { message: "آیتم از سفارش حذف شد", totalPrice: order.totalPrice, paymentStatus: order.paymentStatus },
        { status: 200 }
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error("[admin/orders/:id/items DELETE]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
