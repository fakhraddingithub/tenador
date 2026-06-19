/**
 * src/app/api/admin/orders/[orderId]/eur/route.js
 *
 * مدیریت سیستم یورو (EUR) یک سفارش — کاملاً مستقل از سیستم تومان.
 *
 * این مسیر فقط فیلدهای جدید یورویی را تغییر می‌دهد:
 *   - priceEUR     (قیمت یورویی سفارش)
 *   - paymentsEUR  (تاریخچه‌ی پرداخت‌های یورویی)
 *
 * هیچ‌کدام از فیلدهای تومانی (totalPrice / payments / paymentStatus / ...) و
 * هیچ webhook یا اعلانی از این مسیر لمس نمی‌شود.
 *
 * نکته‌ی مهم درباره‌ی نوشتن داده:
 * از updateOne اتمیک با { strict: false } استفاده می‌کنیم. علتش این است که در
 * حالت توسعه، Next.js با HMR ماژول‌ها را دوباره اجرا می‌کند ولی مدلِ کش‌شده‌ی
 * Mongoose (mongoose.models.Order) همان اسکیمای قدیمی بدون priceEUR را نگه
 * می‌دارد؛ در نتیجه order.save() با strict:true فیلد ناشناخته را بی‌صدا حذف
 * می‌کرد (پاسخ ۲۰۰ ولی بدون ذخیره). آپدیت اتمیک با strict:false این مشکل را حل
 * می‌کند و در پروداکشن هم کاملاً بی‌خطر است. ضمناً چون اتمیک است، هرگز فیلدهای
 * تومانی را لمس یا اعتبارسنجی مجدد نمی‌کند.
 *
 * PATCH  → تنظیم/ویرایش priceEUR
 * POST   → افزودن یک پرداخت یورویی به paymentsEUR
 * PUT    → ویرایش مبلغِ یک پرداخت یورویی موجود (با ردپای ممیزی)
 * DELETE → حذف یک پرداخت یورویی از paymentsEUR
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Order from "base/models/Order";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded || null;
}

// خروجی استاندارد بخش یورو برای کلاینت — با خواندن lean (مستقل از اسکیمای کش‌شده)
async function eurPayload(orderId) {
  const order = await Order.findById(orderId).lean();
  const paymentsEUR = order?.paymentsEUR || [];
  const totalPaidEUR = paymentsEUR.reduce((s, p) => s + (p.amount || 0), 0);
  const priceEUR = order?.priceEUR ?? null;
  const remainingEUR = priceEUR === null ? null : priceEUR - totalPaidEUR;
  return { priceEUR, paymentsEUR, totalPaidEUR, remainingEUR };
}

/* ─── PATCH: تنظیم قیمت یورویی سفارش ─────────────────────────────────── */
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

    const { orderId } = await params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json(
        { message: "شناسه سفارش نامعتبر است" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { priceEUR } = body;

    // اجازه‌ی پاک کردن قیمت با null یا رشته‌ی خالی
    let value = null;
    if (priceEUR !== null && priceEUR !== undefined && priceEUR !== "") {
      const parsed = Number(priceEUR);
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json(
          { message: "قیمت یورو باید عددی نامنفی باشد" },
          { status: 400 }
        );
      }
      value = parsed;
    }

    const result = await Order.updateOne(
      { _id: orderId },
      { $set: { priceEUR: value } },
      { strict: false }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "قیمت یورویی سفارش ذخیره شد", ...(await eurPayload(orderId)) },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id/eur PATCH]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─── POST: افزودن یک پرداخت یورویی ──────────────────────────────────── */
export async function POST(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json(
        { message: "احراز هویت ادمین لازم است" },
        { status: 401 }
      );
    }

    const { orderId } = await params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json(
        { message: "شناسه سفارش نامعتبر است" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { amount, note } = body;

    const parsed = Number(amount);
    if (isNaN(parsed) || parsed <= 0) {
      return NextResponse.json(
        { message: "مبلغ یورو باید عددی مثبت باشد" },
        { status: 400 }
      );
    }

    // زیرسند را کامل می‌سازیم (شامل _id و زمان‌ها) تا مستقل از کست‌شدن توسط
    // اسکیما در هر دو حالت (مدل تازه/کش‌شده) درست ذخیره شود.
    const now = new Date();
    const subdoc = {
      _id: new mongoose.Types.ObjectId(),
      amount: parsed,
      note: typeof note === "string" ? note.trim().slice(0, 500) : "",
      confirmedBy: new mongoose.Types.ObjectId(admin.userId),
      confirmedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const result = await Order.updateOne(
      { _id: orderId },
      { $push: { paymentsEUR: subdoc } },
      { strict: false }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "پرداخت یورویی ثبت شد", ...(await eurPayload(orderId)) },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id/eur POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─── PUT: ویرایش مبلغِ یک پرداخت یورویی موجود ───────────────────────── */
export async function PUT(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json(
        { message: "احراز هویت ادمین لازم است" },
        { status: 401 }
      );
    }

    const { orderId } = await params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ message: "شناسه سفارش نامعتبر است" }, { status: 400 });
    }

    const body = await req.json();
    const { paymentId, amount } = body;
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return NextResponse.json({ message: "شناسه پرداخت نامعتبر است" }, { status: 400 });
    }

    const parsed = Number(amount);
    if (isNaN(parsed) || parsed <= 0) {
      return NextResponse.json(
        { message: "مبلغ یورو باید عددی مثبت باشد" },
        { status: 400 }
      );
    }

    // مبلغ فعلی را برای ثبت در تاریخچه می‌خوانیم (lean، مستقل از اسکیمای کش‌شده)
    const order = await Order.findById(orderId).lean();
    if (!order) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }
    const existing = (order.paymentsEUR || []).find(
      (p) => String(p._id) === String(paymentId)
    );
    if (!existing) {
      return NextResponse.json({ message: "پرداخت یورویی یافت نشد" }, { status: 404 });
    }

    const now = new Date();
    const adminId = new mongoose.Types.ObjectId(admin.userId);

    // read-modify-write روی کل آرایه و $set اتمیک — دقیقاً مثل بقیه‌ی عملیاتِ یورو
    // در همین فایل (POST/PATCH/DELETE). از arrayFilters استفاده نمی‌کنیم چون با
    // strict:false روی مدلِ کش‌شده‌ی HMR قابل‌اتکا اعمال نمی‌شود (سند match می‌شد
    // ولی هیچ تغییری نوشته نمی‌شد → مبلغ ویرایش نمی‌شد).
    const updatedPayments = (order.paymentsEUR || []).map((p) => {
      if (String(p._id) !== String(paymentId)) return p;
      const history = Array.isArray(p.editHistory) ? p.editHistory : [];
      return {
        ...p,
        amount: parsed,
        editedBy: adminId,
        editedAt: now,
        updatedAt: now,
        editHistory: [
          ...history,
          { oldAmount: p.amount || 0, newAmount: parsed, at: now, by: adminId },
        ],
      };
    });

    const result = await Order.updateOne(
      { _id: orderId },
      { $set: { paymentsEUR: updatedPayments } },
      { strict: false }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "مبلغ پرداخت یورویی ویرایش شد", ...(await eurPayload(orderId)) },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id/eur PUT]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}

/* ─── DELETE: حذف یک پرداخت یورویی ───────────────────────────────────── */
export async function DELETE(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json(
        { message: "احراز هویت ادمین لازم است" },
        { status: 401 }
      );
    }

    const { orderId } = await params;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return NextResponse.json(
        { message: "شناسه سفارش نامعتبر است" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { paymentId } = body;
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return NextResponse.json(
        { message: "شناسه پرداخت نامعتبر است" },
        { status: 400 }
      );
    }

    const result = await Order.updateOne(
      { _id: orderId },
      { $pull: { paymentsEUR: { _id: new mongoose.Types.ObjectId(paymentId) } } },
      { strict: false }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "سفارش یافت نشد" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "پرداخت یورویی حذف شد", ...(await eurPayload(orderId)) },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/orders/:id/eur DELETE]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
