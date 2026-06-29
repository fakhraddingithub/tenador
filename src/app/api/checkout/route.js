/**
 * src/app/api/checkout/route.js
 *
 * ثبت نهایی سفارش همراه با پرداخت — سفارش فقط زمانی ساخته می‌شود که
 * پرداخت (رسید بانکی) یا درخواست اقساط به‌طور کامل ثبت شده باشد.
 *
 * تا قبل از فراخوانی این endpoint هیچ سفارشی در دیتابیس ساخته نمی‌شود؛
 * کاربر می‌تواند آزادانه سبد خرید را تغییر دهد و دوباره به صفحه پرداخت بیاید.
 *
 * POST body:
 *  {
 *    items: [{ productId?, variantId?, usedProductId?, itemType, quantity, flowSelections? }],
 *    addressId?:       string,
 *    addressSnapshot?: object,   // آدرس موقت (ذخیره نمی‌شود)
 *    paymentMethod:    "BANK_RECEIPT" | "INSTALLMENT",   // ONLINE فعلاً غیرفعال است
 *    couponCode?:      string,
 *    description?:     string,
 *    receiptImageUrls?: string[],   // BANK_RECEIPT
 *    installment?: {
 *      downPaymentAmount:      number,    // تومان
 *      downPaymentReceiptUrls: string[],
 *      numberOfChecks:         number,
 *      checks: [{ amount, dueDate, checkNumber?, receiptImageUrl? }]
 *    }
 *  }
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
import Payment from "base/models/Payment";
import Installment from "base/models/Installment";
import User from "base/models/User";
import { computeCartPrice } from "base/services/priceEngine";
import {
  notifyNewOrder,
  notifyCoachStudentOrder,
} from "base/services/notificationService";
import { autoAssignUsedProductTracking } from "@/lib/usedTrackingAuto";
import { sendOrderConfirmationEmail } from "@/lib/emailService";
import { getMonthlyInstallmentRate } from "@/lib/installmentRateService";
import { buildInstallmentTerms } from "@/lib/installmentFinance";
import { buildVariantSnapshot } from "@/lib/variantImages";

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
  return verifyToken(token) || null;
}

function badRequest(message, status = 400) {
  return NextResponse.json({ message }, { status });
}

// نرمال‌سازی آرایه URLهای رسید (آرایه یا رشته تکی)
function normalizeReceiptUrls(urls) {
  return Array.isArray(urls) ? urls.filter(Boolean) : urls ? [urls] : [];
}

/** آیتم‌های دست‌دوم یک سفارش را رزرو می‌کند */
async function reserveUsedProducts(order) {
  const usedItems = order.items.filter(
    (i) => i.itemType === "used_product" && i.usedProduct,
  );
  for (const item of usedItems) {
    await UsedProduct.findByIdAndUpdate(item.usedProduct, {
      status: "reserved",
      order: order._id,
    });
  }
}

async function sendConfirmationEmail(orderId, userId, installmentInfo = null) {
  try {
    const populatedOrder = await Order.findById(orderId)
      .populate("items.product", "_id name mainImage")
      .populate("items.variant", "_id attributes images sku")
      .populate("items.flowSelections.selectedProduct", "_id name mainImage")
      .lean();

    const userDoc = await User.findById(userId).select("email").lean();

    await sendOrderConfirmationEmail(
      populatedOrder,
      userDoc?.email ?? null,
      installmentInfo,
    );
  } catch (emailErr) {
    console.error("خطا در ارسال ایمیل:", emailErr);
  }
}

export async function POST(req) {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return badRequest("احراز هویت لازم است", 401);
    }

    const {
      items,
      addressId,
      addressSnapshot,
      paymentMethod,
      couponCode,
      description,
      receiptImageUrls,
      installment,
    } = await req.json();

    // ═══ ۱. اعتبارسنجی کامل — قبل از هرگونه نوشتن در دیتابیس ═══

    if (!Array.isArray(items) || items.length === 0) {
      return badRequest("سبد خرید خالی است");
    }

    if (!addressId && !addressSnapshot) {
      return badRequest("آدرس تحویل الزامی است");
    }

    if (paymentMethod === "ONLINE") {
      return badRequest("پرداخت آنلاین در حال حاضر غیرفعال است");
    }

    if (!["BANK_RECEIPT", "INSTALLMENT"].includes(paymentMethod)) {
      return badRequest("روش پرداخت معتبر نیست");
    }

    // ─── آدرس ───
    let snap;
    let resolvedAddressId = null;

    if (addressId) {
      const addressDoc = await Address.findOne({ _id: addressId, user: user.userId });
      if (!addressDoc) {
        return badRequest("آدرس یافت نشد", 404);
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

    // ─── موجودی محصولات دست‌دوم ───
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
        return badRequest("محصول دست‌دوم یافت نشد", 404);
      }
      if (up.status !== "available") {
        return badRequest(`محصول دست‌دوم "${up.name}" دیگر موجود نیست`, 409);
      }
      usedProductsMap[targetId] = up;
    }

    // ─── نرمال‌سازی آیتم‌ها برای پرایس‌انجین ───
    const normalizedItems = items.map((i) => {
      if (i.itemType === "used_product" || i.usedProductId) {
        const targetId = i.usedProductId || i.productId;
        const upDoc = usedProductsMap[targetId];
        return {
          productId:     upDoc?.product || targetId,
          usedProductId: targetId,
          quantity:      1,
          itemType:      "used_product",
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

    // ─── محاسبه سرور-ساید قیمت‌ها ───
    let priceResult;
    try {
      priceResult = await computeCartPrice(
        normalizedItems,
        user,
        couponCode || null,
      );
    } catch (err) {
      return badRequest(err.message || "خطا در محاسبه قیمت");
    }

    if (!priceResult.items?.length) {
      return badRequest("هیچ محصول معتبری در سبد خرید یافت نشد");
    }

    if (priceResult.finalTotalToman <= 0) {
      return badRequest("مبلغ سفارش نامعتبر است");
    }

    // ─── محافظت از مبلغ نهایی: اگر کد تخفیف ارسال شده ولی سرور آن را نپذیرفته،
    // سفارش ساخته نمی‌شود تا مبلغ نمایش‌داده‌شده به کاربر با مبلغ سفارش یکی بماند
    // (مثلاً انقضای کد یا پر شدن ظرفیت بین نمایش و ثبت) ───
    if (couponCode && !priceResult.coupon) {
      return badRequest(
        priceResult.couponError ||
          "کد تخفیف دیگر معتبر نیست؛ آن را حذف یا اصلاح کنید و دوباره تلاش کنید",
      );
    }

    const totalPrice = priceResult.finalTotalToman;

    // ─── اعتبارسنجی داده‌های پرداخت (قبل از ساخت سفارش) ───
    let bankImageUrls = [];
    let installmentData = null;

    if (paymentMethod === "BANK_RECEIPT") {
      bankImageUrls = normalizeReceiptUrls(receiptImageUrls);

      if (bankImageUrls.length === 0) {
        return badRequest("حداقل یک تصویر رسید بانکی الزامی است");
      }
      if (bankImageUrls.length > 5) {
        return badRequest("حداکثر ۵ تصویر رسید مجاز است");
      }
    }

    if (paymentMethod === "INSTALLMENT") {
      if (!installment) {
        return badRequest("اطلاعات اقساط ناقص است");
      }

      const downPaymentAmount = Number(installment.downPaymentAmount);
      const numberOfChecks    = Number(installment.numberOfChecks);
      const checks            = installment.checks;
      const downPaymentImages = normalizeReceiptUrls(installment.downPaymentReceiptUrls);

      if (!downPaymentAmount || downPaymentAmount <= 0) {
        return badRequest("مبلغ پیش‌پرداخت معتبر نیست");
      }
      if (downPaymentAmount > totalPrice) {
        return badRequest("پیش‌پرداخت نمی‌تواند بیشتر از مبلغ کل سفارش باشد");
      }
      if (downPaymentImages.length === 0) {
        return badRequest("حداقل یک تصویر رسید پیش‌پرداخت الزامی است");
      }
      if (downPaymentImages.length > 5) {
        return badRequest("حداکثر ۵ تصویر رسید مجاز است");
      }
      if (!numberOfChecks || numberOfChecks < 1 || numberOfChecks > 12) {
        return badRequest("تعداد اقساط باید بین ۱ تا ۱۲ باشد");
      }
      if (!Array.isArray(checks) || checks.length !== numberOfChecks) {
        return badRequest("تعداد چک‌ها با تعداد اقساط مطابقت ندارد");
      }

      for (const c of checks) {
        if (!c?.amount || Number(c.amount) <= 0) {
          return badRequest("مبلغ همه چک‌ها باید معتبر و بزرگ‌تر از صفر باشد");
        }
        const due = new Date(c.dueDate);
        if (!c.dueDate || isNaN(due.getTime())) {
          return badRequest("تاریخ سررسید چک‌ها معتبر نیست");
        }
      }

      // ─── نرخ سود ماهانه‌ی سراسری (Part 1) — به‌صورت پویا و امن خوانده می‌شود ───
      const monthlyRatePct = await getMonthlyInstallmentRate();

      // مانده + سود ماهانه — منبع واحد محاسبه (installmentFinance). همه مبالغ تومان.
      const remaining = totalPrice - downPaymentAmount;
      const terms = buildInstallmentTerms({
        principal: remaining,
        downPaymentAmount,
        monthlyRatePct,
        numberOfChecks,
      });
      const expectedChecksTotal = terms.totalPayable;
      const checksTotal = checks.reduce((s, c) => s + Number(c.amount || 0), 0);

      if (Math.abs(checksTotal - expectedChecksTotal) > 100) {
        return badRequest(
          `مجموع مبلغ چک‌ها (${Math.round(checksTotal)}) باید برابر با مانده سفارش به‌همراه سود (${Math.round(expectedChecksTotal)}) باشد`,
        );
      }

      installmentData = {
        downPaymentAmount,
        downPaymentImages,
        numberOfChecks,
        checks,
        terms, // اسنپ‌شات تاریخی که روی سفارش قفل می‌شود
      };
    }

    // ─── اسنپ‌شاتِ واریانت برای نمایشِ پایدارِ سفارش (تصویر/چندواحدی) ───
    // مستقل از computeCartPrice بارگذاری می‌شود چون آنجا category فقط _id دارد.
    const snapProductMap = new Map();
    const snapVariantMap = new Map();
    const snapVariantIds = priceResult.items.filter((i) => i.variantId).map((i) => i.variantId);
    if (snapVariantIds.length) {
      const snapProductIds = priceResult.items
        .filter((i) => i.variantId && i.productId)
        .map((i) => i.productId);
      const [snapProducts, snapVariants] = await Promise.all([
        Product.find({ _id: { $in: snapProductIds } })
          .populate("category", "variantAttributes")
          .lean(),
        Variant.find({ _id: { $in: snapVariantIds } }).lean(),
      ]);
      for (const p of snapProducts) snapProductMap.set(p._id.toString(), p);
      for (const v of snapVariants) snapVariantMap.set(v._id.toString(), v);
    }

    // ═══ ۲. ساخت آیتم‌های سفارش ═══
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

      const vId = item.variantId || originalItem?.variantId || null;
      const pId = item.productId || originalItem?.productId;
      const snapVariant = vId ? snapVariantMap.get(String(vId)) : null;
      const snapProduct = snapProductMap.get(String(pId));

      return {
        product:   pId,
        variant:   vId,
        itemType:  "product",
        quantity:  item.quantity  || originalItem?.quantity  || 1,
        unitPrice: item.unitFinalPrice || item.unitPrice,
        flowSelections: Array.isArray(item.flowSelections)
          ? item.flowSelections.map(mapFlowSelectionToOrder)
          : [],
        variantSnapshot:
          snapVariant && snapProduct ? buildVariantSnapshot(snapVariant, snapProduct) : [],
      };
    });

    // ═══ ۳. ساخت سفارش + پرداخت — سفارش بدون پرداخت باقی نمی‌ماند ═══
    const order = await Order.create({
      user:           user.userId,
      items:          orderItems,
      subtotalPrice:  priceResult.subtotalToman,
      discountAmount: priceResult.discountToman,
      couponDiscount: priceResult.couponDiscountToman,
      totalPrice,
      coupon: priceResult.coupon
        ? { code: priceResult.coupon.code, _id: priceResult.coupon._id }
        : { code: null, _id: null },
      paymentMethod,
      paymentStatus:     "UNPAID",
      fulfillmentStatus: "WAITING",
      address: {
        ref:      resolvedAddressId, // null برای آدرس موقت
        snapshot: snap,
      },
      description: description || "",
      // اسنپ‌شات تاریخی شرایط اقساط — فقط برای سفارش‌های اقساطی
      ...(installmentData?.terms ? { installmentTerms: installmentData.terms } : {}),
    });

    let payment;
    let installmentDoc = null;

    try {
      if (paymentMethod === "BANK_RECEIPT") {
        payment = await Payment.create({
          order:  order._id,
          method: "BANK_RECEIPT",
          amount: totalPrice,
          status: "PENDING",
          bankReceipt: {
            imageUrls:    bankImageUrls,
            uploadedAt:   new Date(),
            reviewStatus: "PENDING",
          },
        });

        order.payments.push(payment._id);
        await order.save();
      } else {
        // INSTALLMENT — پیش‌پرداخت + سند اقساط
        payment = await Payment.create({
          order:  order._id,
          method: "BANK_RECEIPT",
          amount: installmentData.downPaymentAmount,
          status: "PENDING",
          bankReceipt: {
            imageUrls:    installmentData.downPaymentImages,
            uploadedAt:   new Date(),
            reviewStatus: "PENDING",
          },
        });

        installmentDoc = await Installment.create({
          order:          order._id,
          downPayment:    payment._id,
          totalAmount:    totalPrice,
          numberOfChecks: installmentData.numberOfChecks,
          status:         "PENDING",
          checks: installmentData.checks.map((c) => ({
            checkNumber:     c.checkNumber ?? null,
            amount:          Number(c.amount),
            dueDate:         new Date(c.dueDate),
            status:          "PENDING",
            receiptImageUrl: c.receiptImageUrl ?? null,
          })),
        });

        order.payments.push(payment._id);
        order.paymentStatus = "PARTIALLY_PAID";
        await order.save();
      }
    } catch (err) {
      // جبران: سفارش بدون پرداخت نباید باقی بماند
      try {
        if (payment?._id) await Payment.findByIdAndDelete(payment._id);
        if (installmentDoc?._id) await Installment.findByIdAndDelete(installmentDoc._id);
        await Order.findByIdAndDelete(order._id);
      } catch (cleanupErr) {
        console.error("خطا در پاک‌سازی سفارش ناقص:", cleanupErr);
      }
      throw err;
    }

    // ═══ ۴. اقدامات پس از ثبت (خطاها روند را متوقف نمی‌کنند) ═══

    // رزرو محصولات دست‌دوم
    try {
      await reserveUsedProducts(order);
    } catch (err) {
      console.warn("خطا در رزرو محصولات دست‌دوم:", err?.message);
    }

    // اختصاص خودکار tracking انبار به محصولات دست‌دوم
    try {
      await autoAssignUsedProductTracking(order);
    } catch (err) {
      console.warn("خطا در اختصاص خودکار tracking محصول دست‌دوم:", err?.message);
    }

    // ایمیل فاکتور — برای سفارش اقساطی، زمان‌بندی اقساط هم ضمیمه می‌شود
    const installmentEmailInfo =
      paymentMethod === "INSTALLMENT" && installmentData
        ? {
            checks: installmentData.checks,
            numberOfChecks: installmentData.numberOfChecks,
            downPaymentAmount: installmentData.downPaymentAmount,
          }
        : null;
    await sendConfirmationEmail(order._id, user.userId, installmentEmailInfo);

    // ─── اعلان‌های پنل مدیریت (شکست در ساخت اعلان روند را متوقف نمی‌کند) ───
    // اعلان سفارش جدید
    await notifyNewOrder(order);

    // اگر خریدار شاگردِ یک مربی باشد → اعلان ثبت کردیت برای مربی
    try {
      const buyer = await User.findById(user.userId).select("coach").lean();
      if (buyer?.coach) {
        const coach = await User.findById(buyer.coach).select("name").lean();
        if (coach) await notifyCoachStudentOrder(order, coach);
      }
    } catch (notifErr) {
      console.warn("خطا در اعلان شاگرد مربی:", notifErr?.message);
    }

    return NextResponse.json(
      {
        message:
          paymentMethod === "INSTALLMENT"
            ? "سفارش و درخواست اقساط با موفقیت ثبت شد و در انتظار تأیید است"
            : "سفارش و رسید بانکی با موفقیت ثبت شد و در انتظار تأیید است",
        orderId:      order._id,
        trackingCode: order.trackingCode,
        totalPrice,
        payment,
        installment:  installmentDoc,
        couponError:  priceResult.couponError || null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("خطا در ثبت نهایی سفارش:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
