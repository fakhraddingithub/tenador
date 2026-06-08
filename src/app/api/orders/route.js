/**
 * src/app/api/orders/route.js
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";
import Address from "base/models/Address";
import UsedProduct from "base/models/UsedProduct";
import Product from "base/models/Product";
import Variant from "base/models/Variant";
import { computeCartPrice } from "base/services/priceEngine";
import { autoAssignUsedProductTracking } from "@/lib/usedTrackingAuto";

// تبدیل انتخاب فرایندِ غنی‌شده (از پرایس‌انجین) به شکل ذخیره‌سازی در سفارش
function mapFlowSelectionToOrder(sel) {
  if (sel?.nodeType === "service") {
    return {
      nodeId: sel.nodeId,
      nodeLabel: sel.nodeLabel ?? "",
      nodeType: "service",
      serviceLabel: sel.serviceOption?.label ?? "",
      serviceValue: String(sel.serviceOption?.value ?? ""),
      addonToman: Number(sel.addonToman) || 0,
    };
  }
  return {
    nodeId: sel.nodeId,
    nodeLabel: sel.nodeLabel ?? "",
    nodeType: "category",
    selectedProduct: sel.selectedProductId || null,
    selectedVariant: sel.selectedVariantId || null,
    selectedProductName: sel.selectedProductName ?? "",
    selectedVariantLabel: sel.selectedVariantLabel ?? null,
    addonToman: Number(sel.addonToman) || 0,
  };
}

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
        { status: 401 },
      );
    }

    const {
      items,
      addressId,
      addressSnapshot,
      paymentMethod,
      couponCode,
      description,
    } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: "سبد خرید خالی است" },
        { status: 400 },
      );
    }

    if (!addressId && !addressSnapshot) {
      return NextResponse.json(
        { message: "آدرس تحویل الزامی است" },
        { status: 400 },
      );
    }

    if (!["ONLINE", "BANK_RECEIPT", "INSTALLMENT"].includes(paymentMethod)) {
      return NextResponse.json(
        { message: "روش پرداخت معتبر نیست" },
        { status: 400 },
      );
    }

    // ─── ساخت snapshot آدرس ───
    let snap;
    let resolvedAddressId = null;

    if (addressId) {
      const addressDoc = await Address.findOne({ _id: addressId, user: user.userId });
      if (!addressDoc) {
        return NextResponse.json({ message: "آدرس یافت نشد" }, { status: 404 });
      }
      resolvedAddressId = addressId;
      snap = {
        fullName:    addressDoc.fullName,
        phone:       addressDoc.phone,
        province:    addressDoc.province    || "",
        city:        addressDoc.city,
        postalCode:  addressDoc.postalCode,
        addressLine: addressDoc.addressLine,
      };
    } else {
      // آدرس موقت — فقط برای این سفارش، ذخیره نمی‌شود
      snap = {
        fullName:    addressSnapshot.fullName    || "",
        phone:       addressSnapshot.phone       || "",
        province:    addressSnapshot.province    || "",
        city:        addressSnapshot.city        || "",
        postalCode:  addressSnapshot.postalCode  || "",
        addressLine: addressSnapshot.addressLine || "",
      };
    }

    // ─── ۱. بررسی موجودی محصولات دست‌دوم ───
    const usedItems = items.filter(
      (i) => i.itemType === "used_product" || i.usedProductId,
    );

    const usedProductsMap = {};
    for (const ci of usedItems) {
      const targetId = ci.usedProductId || ci.productId;
      const up = await UsedProduct.findById(targetId)
        .select("status name price priceToman product")
        .lean();
      if (!up) {
        return NextResponse.json(
          { message: "محصول دست‌دوم یافت نشد" },
          { status: 404 },
        );
      }
      if (up.status !== "available") {
        return NextResponse.json(
          { message: `محصول دست‌دوم "${up.name}" دیگر موجود نیست` },
          { status: 409 },
        );
      }
      usedProductsMap[targetId] = up;
    }

    // ─── ۲. نرمال‌سازی آیتم‌ها برای پرایس‌انژین ───
    const normalizedItems = items.map((i) => {
      if (i.itemType === "used_product" || i.usedProductId) {
        const targetId = i.usedProductId || i.productId;
        const upDoc = usedProductsMap[targetId];
        return {
          productId:    upDoc?.product || targetId,
          usedProductId: targetId,
          quantity:     1,
          itemType:     "used_product",
        };
      }
      return {
        productId: i.productId,
        variantId: i.variantId ?? null,
        quantity:  Math.max(1, Math.floor(i.quantity || 1)),
        itemType:  "product",
        ...(Array.isArray(i.flowSelections) && i.flowSelections.length > 0
          ? { flowSelections: i.flowSelections }
          : {}),
      };
    });

    // ─── ۳. محاسبه سرور-ساید قیمت‌ها ───
    let priceResult;
    try {
      priceResult = await computeCartPrice(
        normalizedItems,
        user,
        couponCode || null,
      );
    } catch (err) {
      return NextResponse.json(
        { message: err.message || "خطا در محاسبه قیمت" },
        { status: 400 },
      );
    }

    if (!priceResult.items?.length) {
      return NextResponse.json(
        { message: "هیچ محصول معتبری در سبد خرید یافت نشد" },
        { status: 400 },
      );
    }

    if (priceResult.finalTotalToman <= 0) {
      return NextResponse.json(
        { message: "مبلغ سفارش نامعتبر است" },
        { status: 400 },
      );
    }

    // ─── ۴. ساخت orderItems ───
    const orderItems = priceResult.items.map((item, idx) => {
      const originalItem = items[idx];

      const isUsedProduct =
        originalItem?.itemType === "used_product" ||
        !!originalItem?.usedProductId ||
        item.itemType === "used_product" ||
        !!item.usedProductId;

      if (isUsedProduct) {
        const usedId =
          originalItem?.usedProductId ||
          originalItem?.productId ||
          item.usedProductId ||
          item.productId;
        const upDoc = usedProductsMap[usedId];
        return {
          usedProduct: usedId,
          itemType:    "used_product",
          product:     upDoc?.product || item.productId || originalItem?.productId || null,
          variant:     null,
          quantity:    1,
          unitPrice:   item.unitFinalPrice || item.unitPrice,
        };
      }

      return {
        product:   item.productId || originalItem?.productId,
        variant:   item.variantId || originalItem?.variantId || null,
        itemType:  "product",
        quantity:  item.quantity  || originalItem?.quantity  || 1,
        unitPrice: item.unitFinalPrice || item.unitPrice,
        flowSelections: Array.isArray(item.flowSelections)
          ? item.flowSelections.map(mapFlowSelectionToOrder)
          : [],
      };
    });

    // ─── ۵. ذخیره سفارش ───
    const order = await Order.create({
      user:          user.userId,
      items:         orderItems,
      subtotalPrice: priceResult.subtotalToman,
      discountAmount: priceResult.discountToman,
      couponDiscount: priceResult.couponDiscountToman,
      totalPrice:    priceResult.finalTotalToman,
      coupon: priceResult.coupon
        ? { code: priceResult.coupon.code, _id: priceResult.coupon._id }
        : { code: null, _id: null },
      paymentMethod,
      paymentStatus:     "UNPAID",
      fulfillmentStatus: "WAITING",
      address: {
        ref:      resolvedAddressId,  // null برای آدرس موقت
        snapshot: snap,
      },
      description: description || "",
    });

    // ─── ۵.۵ اختصاص خودکار tracking انبار به محصولات دست‌دوم (منحصربه‌فرد) ───
    // خطاها روند ثبت سفارش را متوقف نمی‌کنند.
    try {
      await autoAssignUsedProductTracking(order);
    } catch (err) {
      console.warn("خطا در اختصاص خودکار tracking محصول دست‌دوم:", err?.message);
    }

    return NextResponse.json(
      {
        message:      "سفارش با موفقیت ثبت شد",
        order,
        orderId:      order._id,
        trackingCode: order.trackingCode,
        totalPrice:   priceResult.finalTotalToman,
        couponError:  priceResult.couponError || null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("خطا در ثبت سفارش:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─────────────────────────────────────────────
   GET → لیست سفارش‌های کاربر
───────────────────────────────────────────── */
export async function GET() {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { message: "احراز هویت لازم است" },
        { status: 401 },
      );
    }

    const orders = await Order.find({ user: user.userId })
      .populate({
        path:   "items.product",
        model:  "Product",
        select: "name mainImage sku",
      })
      .populate({
        path:   "items.usedProduct",
        model:  "UsedProduct",
        select: "name images price priceToman status",
      })
      .populate({
        path:   "items.flowSelections.selectedProduct",
        model:  "Product",
        select: "name mainImage",
      })
      .sort({ createdAt: -1 })
      .lean();

    const normalizedOrders = orders.map((order) => {
      const normalizedItems = order.items.map((item) => {
        if (item.itemType === "used_product") {
          return {
            ...item,
            product: {
              _id:       item.usedProduct?._id  || item._id,
              name:      item.usedProduct?.name || "محصول دست‌دوم",
              mainImage: item.usedProduct?.images?.[0] || null,
              sku:       "USED-ITEM",
            },
          };
        }
        return item;
      });
      return { ...order, items: normalizedItems };
    });

    return NextResponse.json({ orders: normalizedOrders }, { status: 200 });
  } catch (error) {
    console.error("[GET Orders Error]:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور در دریافت سفارشات" },
      { status: 500 },
    );
  }
}