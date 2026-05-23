/**
 * POST /api/orders — ثبت سفارش جدید
 * GET  /api/orders — دریافت سفارش‌های کاربر
 *
 * امنیت:
 *  - قیمت ارسالی از کلاینت کاملاً نادیده گرفته می‌شود
 *  - قیمت نهایی مستقیماً در سرور محاسبه می‌شود (pricingService)
 *  - کوپن در همین لحظه validate و usedCount آپدیت می‌شود
 *  - موجودی محصول بررسی می‌شود
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth.js";
import Order from "base/models/Order.js";
import Payment from "base/models/Payment.js";
import Installment from "base/models/Installment.js";
import Address from "base/models/Address.js";
import Product from "base/models/Product.js";
import Variant from "base/models/Variant.js";
import User from "base/models/User.js";
import Coupon from "base/models/Coupon.js";
import mongoose from "mongoose";
import { calculateCartTotal, getExchangeRate, eurToToman } from "base/services/pricingService";

/* ─── Auth Helper ─────────────────────────────────────────── */

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  return decoded;
}

/* ─── POST — ثبت سفارش ─────────────────────────────────────── */

export async function POST(req) {
  await connectToDB();

  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { items, paymentMethod, addressId, description, couponCode } = body;

  /* ── اعتبارسنجی ورودی پایه ── */
  if (!items?.length || !paymentMethod || !addressId) {
    return NextResponse.json(
      { message: "فیلدهای اجباری ناقص است" },
      { status: 400 }
    );
  }

  if (!["ONLINE", "BANK_RECEIPT", "INSTALLMENT"].includes(paymentMethod)) {
    return NextResponse.json({ message: "روش پرداخت نامعتبر است" }, { status: 400 });
  }

  /* ── آدرس ── */
  const addressDoc = await Address.findOne({
    _id: addressId,
    user: auth.userId,
  });
  if (!addressDoc) {
    return NextResponse.json({ message: "آدرس یافت نشد" }, { status: 404 });
  }

  /* ── کاربر (برای role/level تخفیف) ── */
  const user = await User.findById(auth.userId).lean();

  /* ── بارگذاری محصولات و واریانت‌ها ── */
  const productIds = items.map((i) => i.productId || i.product);
  const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId);

  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).lean(),
    variantIds.length > 0 ? Variant.find({ _id: { $in: variantIds } }).lean() : [],
  ]);

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  const variantMap = new Map(variants.map((v) => [v._id.toString(), v]));

  /* ── بررسی موجودی و آماده‌سازی cart items ── */
  const cartItems = [];
  for (const item of items) {
    const pid = (item.productId || item.product)?.toString();
    const product = productMap.get(pid);
    if (!product) {
      return NextResponse.json(
        { message: `محصول ${pid} یافت نشد` },
        { status: 404 }
      );
    }

    const variant = item.variantId ? variantMap.get(item.variantId.toString()) : null;
    const stock = variant ? variant.stock : product.stock;

    if (stock < (item.quantity || 1)) {
      return NextResponse.json(
        { message: `موجودی محصول "${product.name}" کافی نیست` },
        { status: 400 }
      );
    }

    cartItems.push({ product, variant, quantity: item.quantity || 1 });
  }

  /* ── اولین سفارش ── */
  const prevOrdersCount = await Order.countDocuments({ user: auth.userId });
  const isFirstOrder = prevOrdersCount === 0;

  /* ── محاسبه قیمت کامل روی سرور ── */
  const { items: pricedItems, grandTotalToman, couponError } = await calculateCartTotal({
    cartItems,
    user,
    couponCode: couponCode || null,
    isFirstOrder,
  });

  if (couponError) {
    return NextResponse.json({ message: couponError }, { status: 400 });
  }

  if (grandTotalToman <= 0) {
    return NextResponse.json(
      { message: "مجموع سفارش نامعتبر است" },
      { status: 400 }
    );
  }

  /* ── کوپن — پیدا کردن برای ذخیره در سفارش ── */
  let couponDoc = null;
  const appliedCouponId = pricedItems.find((i) => i.couponId)?.couponId;
  if (appliedCouponId) {
    couponDoc = await Coupon.findById(appliedCouponId);
  }

  /* ── شروع session برای atomicity ── */
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    /* ساخت سفارش */
    const [order] = await Order.create(
      [
        {
          user: auth.userId,
          items: pricedItems.map((pi) => ({
            product: pi.productId,
            variant: pi.variantId || undefined,
            quantity: pi.quantity,
            unitPriceToman: pi.unitPriceToman,
            basePriceToman: pi.basePriceToman,
            discountToman: pi.discountToman,
          })),
          totalPrice: grandTotalToman,
          paymentMethod,
          paymentStatus: "UNPAID",
          fulfillmentStatus: "WAITING",
          address: {
            ref: addressDoc._id,
            snapshot: {
              fullName: addressDoc.fullName,
              phone: addressDoc.phone,
              province: addressDoc.province,
              city: addressDoc.city,
              postalCode: addressDoc.postalCode,
              fullAddress: addressDoc.fullAddress,
            },
          },
          coupon: couponDoc
            ? {
                id: couponDoc._id,
                code: couponDoc.code,
                discountToman: pricedItems.reduce((s, i) => s + (i.couponDiscountToman || 0), 0),
              }
            : undefined,
          description: description || "",
        },
      ],
      { session }
    );

    /* کاهش موجودی محصولات */
    for (const pi of pricedItems) {
      if (pi.variantId) {
        await Variant.findByIdAndUpdate(
          pi.variantId,
          { $inc: { stock: -pi.quantity } },
          { session }
        );
      } else {
        await Product.findByIdAndUpdate(
          pi.productId,
          { $inc: { stock: -pi.quantity } },
          { session }
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    return NextResponse.json(
      {
        message: "سفارش با موفقیت ثبت شد",
        order: {
          _id: order._id,
          trackingCode: order.trackingCode,
          totalPrice: grandTotalToman,
          paymentMethod,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("[orders POST]", err);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─── GET — دریافت سفارش‌های کاربر ─────────────────────────── */

export async function GET() {
  await connectToDB();

  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const orders = await Order.find({ user: auth.userId })
    .populate("items.product", "name mainImage slug")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ orders }, { status: 200 });
}
