/**
 * src/app/api/admin/orders/[orderId]/route.js
 *
 * GET   → جزئیات کامل یک سفارش (ادمین)
 *         وقتی ادمین صفحه سفارش را باز می‌کند، reviewedAt ست می‌شود
 * PATCH → بروزرسانی وضعیت سفارش (paymentStatus / fulfillmentStatus)
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";
import Installment from "base/models/Installment";
import { deriveCheckStatus, summarizeInstallment } from "base/services/installmentService";

// فقط برای ثبت شدن مدل‌ها در Mongoose / جلوگیری از MissingSchemaError
import "base/models/Payment";
import "base/models/Product";
import "base/models/Variant";
import "base/models/UsedProduct";
import "base/models/User";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;

  const decoded = verifyToken(token);
  return decoded || null;
}

// تبدیل attributes واریانت (Map) به آبجکت ساده تا در JSON درست سریالایز شود
function normalizeVariant(variant) {
  if (!variant) return variant;
  const attrs =
    variant.attributes instanceof Map
      ? Object.fromEntries(variant.attributes)
      : variant.attributes || {};
  return { ...variant, attributes: attrs };
}

// طرح اقساط مرتبط با این سفارش را (در صورت وجود) به‌صورت خلاصه برمی‌گرداند
async function loadInstallmentForOrder(orderId) {
  const inst = await Installment.findOne({ order: orderId })
    .populate({ path: "downPayment", select: "amount status bankReceipt" })
    .lean();
  if (!inst) return null;

  const now = new Date();
  const summary = summarizeInstallment(inst, now);

  return {
    _id: inst._id,
    status: inst.status,
    derivedStatus: summary.derivedStatus,
    numberOfChecks: inst.numberOfChecks,
    totalAmount: inst.totalAmount,
    createdAt: inst.createdAt,
    orderConfirmedAt: inst.orderConfirmedAt || null,
    downPayment: {
      _id: inst.downPayment?._id || null,
      amount: summary.downPaymentAmount,
      paid: summary.downPaymentPaid,
      status: inst.downPayment?.status || "PENDING",
      reviewStatus: inst.downPayment?.bankReceipt?.reviewStatus || "PENDING",
    },
    paidAmount: summary.paidAmount,
    remainingAmount: summary.remainingAmount,
    paidChecksCount: summary.paidChecksCount,
    remainingChecksCount: summary.remainingChecksCount,
    nextDueDate: summary.nextDueDate,
    overdueCount: summary.overdueCount,
    checks: (inst.checks || [])
      .slice()
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .map((c, idx) => ({
        _id: c._id,
        number: idx + 1,
        checkNumber: c.checkNumber || null,
        amount: c.amount,
        dueDate: c.dueDate,
        status: c.status,
        displayStatus: deriveCheckStatus(c, now),
        paidAt: c.paidAt || null,
        receiptImageUrl: c.receiptImageUrl || null,
        notes: c.notes || "",
        bounceReason: c.bounceReason || "",
      })),
  };
}

function normalizeOrderItems(items = []) {
  return items.map((item) => {
    const variant = normalizeVariant(item.variant);

    if (item?.itemType === "used_product") {
      const usedProduct = item.usedProduct || null;

      return {
        ...item,
        variant,
        usedProduct,
        product: {
          _id: usedProduct?._id || item.product?._id || null,
          name: usedProduct?.name || item.product?.name || "محصول دست‌دوم",
          mainImage: usedProduct?.images?.[0] || item.product?.mainImage || null,
          sku: usedProduct?.sku || "USED-ITEM",
        },
      };
    }

    return { ...item, variant };
  });
}

/* ─── GET: جزئیات سفارش ─────────────────────────────────────────────── */
export async function GET(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json(
        { message: "احراز هویت ادمین لازم است" },
        { status: 401 }
      );
    }

    const { orderId } =await params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json(
        { message: "شناسه سفارش نامعتبر است" },
        { status: 400 }
      );
    }

    // فقط بار اولی که ادمین سفارش را باز می‌کند reviewedAt ست شود
    await Order.updateOne(
      {
        _id: orderId,
        reviewedAt: { $exists: false },
      },
      {
        $set: {
          reviewedAt: new Date(),
          reviewedBy: new mongoose.Types.ObjectId(admin.userId),
        },
      }
    );

    const fullOrder = await Order.findById(orderId)
      .populate({
        path: "user",
        select: "name lastName phone email coach",
        populate: { path: "coach", model: "User", select: "name lastName _id" },
      })
      .populate({
        path: "payments",
        select: "method amount status bankReceipt onlinePayment createdAt meta",
      })
      .populate({
        path: "items.product",
        model: "Product",
        select: "name mainImage sku",
      })
      .populate({
        path: "items.usedProduct",
        model: "UsedProduct",
      })
      .populate({
        path: "items.variant",
        model: "Variant",
        select: "sku attributes images",
      })
      .populate({
        path: "items.flowSelections.selectedProduct",
        model: "Product",
        select: "name mainImage",
      })
      .lean();

    if (!fullOrder) {
      return NextResponse.json(
        { message: "سفارش یافت نشد" },
        { status: 404 }
      );
    }

    fullOrder.items = normalizeOrderItems(fullOrder.items);

    // طرح اقساط مرتبط (در صورت وجود) برای نمایش تبِ «اقساط» در جزئیات سفارش
    const installment =
      fullOrder.paymentMethod === "INSTALLMENT"
        ? await loadInstallmentForOrder(orderId)
        : null;

    return NextResponse.json({ order: fullOrder, installment }, { status: 200 });
  } catch (error) {
    console.error("[admin/orders/:id GET]", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور" },
      { status: 500 }
    );
  }
}

/* ─── PATCH: بروزرسانی وضعیت ────────────────────────────────────────── */
export async function PATCH(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json(
        { message: "احراز هویت ادمین لازم است" },
        { status: 401 }
      );
    }

    const { orderId } =await params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json(
        { message: "شناسه سفارش نامعتبر است" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { paymentStatus, fulfillmentStatus } = body;

    const VALID_PAYMENT_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"];
    const VALID_FULFILLMENT_STATUSES = [
      "WAITING",
      "NEEDS_PURCHASE",
      "PROCESSING",
      "SENT",
      "DELIVERED",
      "CANCELED",
    ];

    if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      return NextResponse.json(
        { message: "وضعیت پرداخت نامعتبر است" },
        { status: 400 }
      );
    }

    if (
      fulfillmentStatus &&
      !VALID_FULFILLMENT_STATUSES.includes(fulfillmentStatus)
    ) {
      return NextResponse.json(
        { message: "وضعیت ارسال نامعتبر است" },
        { status: 400 }
      );
    }

    const update = {
      reviewedBy: new mongoose.Types.ObjectId(admin.userId),
      reviewedAt: new Date(),
    };

    if (paymentStatus) update.paymentStatus = paymentStatus;
    if (fulfillmentStatus) update.fulfillmentStatus = fulfillmentStatus;

    const order = await Order.findByIdAndUpdate(
      orderId,
      { $set: update },
      { new: true }
    )
      .populate({
        path: "user",
        select: "name lastName phone email coach",
        populate: { path: "coach", model: "User", select: "name lastName _id" },
      })
      .populate({
        path: "payments",
        select: "method amount status bankReceipt onlinePayment createdAt meta",
      })
      .populate({
        path: "items.product",
        model: "Product",
        select: "name mainImage sku",
      })
      .populate({
        path: "items.usedProduct",
        model: "UsedProduct",
      })
      .populate({
        path: "items.variant",
        model: "Variant",
        select: "sku attributes images",
      })
      .populate({
        path: "items.flowSelections.selectedProduct",
        model: "Product",
        select: "name mainImage",
      })
      .lean();

    if (!order) {
      return NextResponse.json(
        { message: "سفارش یافت نشد" },
        { status: 404 }
      );
    }

    order.items = normalizeOrderItems(order.items);

    const installment =
      order.paymentMethod === "INSTALLMENT"
        ? await loadInstallmentForOrder(orderId)
        : null;

    return NextResponse.json(
      { message: "وضعیت سفارش با موفقیت بروزرسانی شد", order, installment },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id PATCH]", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور" },
      { status: 500 }
    );
  }
}