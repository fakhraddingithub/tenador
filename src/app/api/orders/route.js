/**
 * src/app/api/orders/route.js
 *
 * ثبت سفارش — پشتیبانی کامل و اصلاح‌شده از محصولات معمولی و دست‌دوم
 * رفع مشکل: اعمال دقیق نرخ تبدیل ارز و محاسبات تومانی پرایس‌انژین برای محصولات دست‌دوم
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";
import Address from "base/models/Address";
import UsedProduct from "base/models/UsedProduct";
import { computeCartPrice } from "base/services/priceEngine";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded || null;
}

export async function POST(req) {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { message: "احراز هویت لازم است" },
        { status: 401 }
      );
    }

    const { items, addressId, paymentMethod, couponCode, description } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: "سبد خرید خالی است" },
        { status: 400 }
      );
    }

    if (!addressId) {
      return NextResponse.json(
        { message: "آدرس تحویل الزامی است" },
        { status: 400 }
      );
    }

    if (!["ONLINE", "BANK_RECEIPT", "INSTALLMENT"].includes(paymentMethod)) {
      return NextResponse.json(
        { message: "روش پرداخت معتبر نیست" },
        { status: 400 }
      );
    }

    const addressDoc = await Address.findOne({
      _id: addressId,
      user: user.userId,
    });
    if (!addressDoc) {
      return NextResponse.json({ message: "آدرس یافت نشد" }, { status: 404 });
    }

    // ─── ۱. بررسی موجودی محصولات دست‌دوم و استخراج آی‌دی محصول اصلی (پدر) ───
    const usedItems = items.filter(
      (i) => i.itemType === "used_product" || i.usedProductId
    );
    
    const usedProductsMap = {};
    for (const ci of usedItems) {
      const targetId = ci.usedProductId || ci.productId; 
      const up = await UsedProduct.findById(targetId)
        .select("status name price priceToman product")
        .lean();
      if (!up) {
        return NextResponse.json(
          { message: `محصول دست‌دوم یافت نشد` },
          { status: 404 }
        );
      }
      if (up.status !== "available") {
        return NextResponse.json(
          { message: `محصول دست‌دوم "${up.name}" دیگر موجود نیست` },
          { status: 409 }
        );
      }
      // ذخیره اطلاعات محصول دست‌دوم همراه با ریفرنس محصول اصلی آن
      usedProductsMap[targetId] = up;
    }

    // ─── ۲. نرمال‌سازی هوشمند آیتم‌ها برای پرایس‌انژین ───
    const normalizedItems = items.map((i) => {
      if (i.itemType === "used_product" || i.usedProductId) {
        const targetId = i.usedProductId || i.productId;
        const upDoc = usedProductsMap[targetId];
        return {
          productId: upDoc?.product || targetId,   // 💡 تزریق آی‌دی محصول اصلی (پدر) برای فعال شدن محاسبات ارزی موتور قیمت
          usedProductId: targetId,                 // شناسه اختصاصی دست‌دوم
          quantity: 1,
          itemType: "used_product",
        };
      }
      return {
        productId: i.productId,
        variantId: i.variantId ?? null,
        quantity: Math.max(1, Math.floor(i.quantity || 1)),
        itemType: "product",
      };
    });

    // ─── ۳. محاسبه سرور-ساید قیمت‌ها (تبدیل یورو به تومان و اعمال قوانین مالی) ───
    let priceResult;
    try {
      priceResult = await computeCartPrice(
        normalizedItems,
        user,
        couponCode || null
      );
    } catch (err) {
      return NextResponse.json(
        { message: err.message || "خطا در محاسبه قیمت" },
        { status: 400 }
      );
    }

    if (!priceResult.items || !priceResult.items.length) {
      return NextResponse.json(
        { message: "هیچ محصول معتبری در سبد خرید یافت نشد" },
        { status: 400 }
      );
    }

    if (priceResult.finalTotalToman <= 0) {
      return NextResponse.json(
        { message: "مبلغ سفارش نامعتبر است" },
        { status: 400 }
      );
    }

    // ─── ۴. ساخت هوشمند و متقاطع orderItems بر اساس خروجی پرایس‌انژین ───
    const orderItems = priceResult.items.map((item, idx) => {
      const originalItem = items[idx];
      
      const isUsedProduct = 
        originalItem?.itemType === "used_product" || 
        !!originalItem?.usedProductId ||
        item.itemType === "used_product" || 
        !!item.usedProductId;

      if (isUsedProduct) {
        const usedId = originalItem?.usedProductId || originalItem?.productId || item.usedProductId || item.productId;
        const upDoc = usedProductsMap[usedId];
        return {
          usedProduct: usedId,            // شناسه قطعی دست‌دوم
          itemType: "used_product",        
          product: upDoc?.product || item.productId || originalItem?.productId || null, // آی‌دی محصول پدر
          variant: null,
          quantity: 1,
          unitPrice: item.unitFinalPrice || item.unitPrice, // 💎 قیمتی که موتور بر اساس نرخ روز ارز به تومان تبدیل کرده است
        };
      }
      
      // محصولات معمولی
      return {
        product: item.productId || originalItem?.productId,
        variant: item.variantId || originalItem?.variantId || null,
        itemType: "product",
        quantity: item.quantity || originalItem?.quantity || 1,
        unitPrice: item.unitFinalPrice || item.unitPrice,
      };
    });

    // ─── ۵. آدرس snapshot ───
    const snap = {
      fullName: addressDoc.fullName,
      phone: addressDoc.phone,
      province: addressDoc.province,
      city: addressDoc.city,
      postalCode: addressDoc.postalCode,
      addressLine: addressDoc.addressLine,
    };

    // ─── ۶. ذخیره نهایی سفارش در دیتابیس ───
    const order = await Order.create({
      user: user.userId,
      items: orderItems,
      subtotalPrice: priceResult.subtotalToman,
      discountAmount: priceResult.discountToman,
      couponDiscount: priceResult.couponDiscountToman,
      totalPrice: priceResult.finalTotalToman,
      coupon: priceResult.coupon
        ? { code: priceResult.coupon.code, _id: priceResult.coupon._id }
        : { code: null, _id: null },
      paymentMethod,
      paymentStatus: "UNPAID",
      fulfillmentStatus: "WAITING",
      address: {
        ref: addressId,
        snapshot: snap,
      },
      description: description || "",
    });

    // ─── ۷. رزرو محصولات دست‌دوم (status → reserved) ───
    for (const ci of usedItems) {
      const targetId = ci.usedProductId || ci.productId;
      await UsedProduct.findByIdAndUpdate(targetId, {
        status: "reserved",
        order: order._id,
      });
    }

    return NextResponse.json(
      {
        message: "سفارش با موفقیت ثبت شد",
        order, 
        orderId: order._id,
        trackingCode: order.trackingCode,
        totalPrice: priceResult.finalTotalToman,
        couponError: priceResult.couponError || null,
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
      return NextResponse.json(
        { message: "احراز هویت لازم است" },
        { status: 401 }
      );
    }


    // استفاده از Populate پیشرفته و صریح
    const orders = await Order.find({ user: user.userId })
      .populate({
        path: "items.product",
        model: "Product", // معرفی مستقیم کالکشن
        select: "name mainImage sku"
      })
      .populate({
        path: "items.usedProduct",
        model: "UsedProduct", // معرفی مستقیم کالکشن به مانگوس
        select: "name images price priceToman status"
      })
      .sort({ createdAt: -1 })
      .lean();

   // ... کدهای دریافت orders با populate (بدون تغییر) ...

   const normalizedOrders = orders.map((order) => {
    const normalizedItems = order.items.map((item) => {
      
      // اگر آیتم دست‌دوم است
      if (item.itemType === "used_product") {
        return {
          ...item,
          // 💡 ترفند اصلی: بازسازی ساختار product با دیتای usedProduct
          product: {
            _id: item.usedProduct?._id || item._id,
            name: item.usedProduct?.name || "محصول دست‌دوم",
            // گرفتن اولین عکس از آرایه images دست‌دوم
            mainImage: item.usedProduct?.images?.[0] || null,
            sku: "USED-ITEM"
          }
        };
      }

      // اگر آیتم نو است، دست نخورده برمی‌گردد (چون product.name و غیره رو از قبل داره)
      return item;
    });

    return { ...order, items: normalizedItems };
  });

  return NextResponse.json({ orders: normalizedOrders }, { status: 200 });
  } catch (error) {
    console.error("[GET Orders Error]:", error);
    return NextResponse.json({ message: "خطای داخلی سرور در دریافت سفارشات" }, { status: 500 });
  }
}