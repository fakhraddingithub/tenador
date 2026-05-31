/**
 * src/app/api/orders/route.js
 *
 * ثبت سفارش — قیمت‌ها کاملاً سمت سرور تأیید می‌شوند
 *
 * POST body:
 *  {
 *    items:         [{ productId, variantId?, quantity }],
 *    addressId:     string,
 *    paymentMethod: "ONLINE" | "BANK_RECEIPT" | "INSTALLMENT",
 *    couponCode?:   string,
 *    description?:  string
 *  }
 *
 * ⚠️  کلاینت هیچ قیمتی ارسال نمی‌کند — همه قیمت‌ها سمت سرور محاسبه می‌شوند
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";
import Address from "base/models/Address";
import { computeCartPrice } from "base/services/priceEngine";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded || null;
}

/* ────────────────────────────────────────────
   POST → ثبت سفارش جدید
───────────────────────────────────────────── */
export async function POST(req) {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    const { items, addressId, paymentMethod, couponCode, description } = await req.json();

    // ─── اعتبارسنجی اولیه ───
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: "سبد خرید خالی است" }, { status: 400 });
    }

    if (!addressId) {
      return NextResponse.json({ message: "آدرس تحویل الزامی است" }, { status: 400 });
    }

    if (!["ONLINE", "BANK_RECEIPT", "INSTALLMENT"].includes(paymentMethod)) {
      return NextResponse.json({ message: "روش پرداخت معتبر نیست" }, { status: 400 });
    }

    // ─── تأیید آدرس متعلق به کاربر ───
    const addressDoc = await Address.findOne({ _id: addressId, user: user.userId });
    if (!addressDoc) {
      return NextResponse.json({ message: "آدرس یافت نشد" }, { status: 404 });
    }

    // ─── محاسبه سرور-ساید قیمت‌ها ───
    // این مرحله از هرگونه دستکاری قیمت از سمت کلاینت جلوگیری می‌کند
    const priceResult = await computeCartPrice(
      items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId ?? null,
        quantity:  Math.max(1, Math.floor(i.quantity || 1)),
      })),
      user,
      couponCode || null
    );

    if (!priceResult.items.length) {
      return NextResponse.json({ message: "هیچ محصول معتبری در سبد خرید یافت نشد" }, { status: 400 });
    }

    if (priceResult.finalTotalToman <= 0) {
      return NextResponse.json({ message: "مبلغ سفارش نامعتبر است" }, { status: 400 });
    }

    // ─── بررسی موجودی انبار ───
    const { default: Product } = await import("base/models/Product");
    const { default: Variant  } = await import("base/models/Variant");

    // for (const item of priceResult.items) {
    //   if (item.variantId) {
    //     const variant = await Variant.findById(item.variantId).select("stock").lean();
    //     if (!variant || variant.stock < item.quantity) {
    //       return NextResponse.json(
    //         { message: `موجودی کافی برای ${item.productName} وجود ندارد` },
    //         { status: 409 }
    //       );
    //     }
    //   } else {
    //     const product = await Product.findById(item.productId).select("stock").lean();
    //     if (!product || product.stock < item.quantity) {
    //       return NextResponse.json(
    //         { message: `موجودی کافی برای ${item.productName} وجود ندارد` },
    //         { status: 409 }
    //       );
    //     }
    //   }
    // }

    // ─── ساخت سفارش ───
    const orderItems = priceResult.items.map((item) => ({
      product:   item.productId,
      variant:   item.variantId ?? null,
      quantity:  item.quantity,
      unitPrice: item.unitFinalPrice,  // قیمت تأییدشده سمت سرور
    }));

    const order = await Order.create({
      user:            user.userId,
      items:           orderItems,
      totalPrice:      priceResult.finalTotalToman,
      subtotalPrice:   priceResult.subtotalToman,
      discountAmount:  priceResult.discountToman,
      couponDiscount:  priceResult.couponDiscountToman,
      coupon:          priceResult.coupon
        ? { code: priceResult.coupon.code, _id: priceResult.coupon._id }
        : null,
      paymentMethod,
      paymentStatus:   "UNPAID",
      fulfillmentStatus: "WAITING",
      address: {
        ref: addressDoc._id,
        snapshot: {
          fullName:    addressDoc.fullName,
          phone:       addressDoc.phone,
          province:    addressDoc.province,
          city:        addressDoc.city,
          postalCode:  addressDoc.postalCode,
          addressLine: addressDoc.addressLine,
        },
      },
      description: description?.slice(0, 500) ?? "",
    });

    // ─── کاهش موجودی ───
    for (const item of priceResult.items) {
      if (item.variantId) {
        await Variant.findByIdAndUpdate(item.variantId, { $inc: { stock: -item.quantity } });
      } else {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
      }
    }

    return NextResponse.json(
      {
        message:  "سفارش با موفقیت ثبت شد",
        order: {
          _id:           order._id,
          trackingCode:  order.trackingCode,
          totalPrice:    order.totalPrice,
          paymentMethod: order.paymentMethod,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("خطا در ثبت سفارش:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ────────────────────────────────────────────
   GET → لیست سفارش‌های کاربر
───────────────────────────────────────────── */
export async function GET() {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    const orders = await Order.find({ user: user.userId })
      .populate("items.product", "name mainImage sku")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    console.error("خطا در دریافت سفارش‌ها:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
