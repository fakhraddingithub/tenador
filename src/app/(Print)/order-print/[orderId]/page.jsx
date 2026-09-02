/**
 * src/app/(Print)/order-print/[orderId]/page.jsx
 *
 * برگه‌ی چاپِ آدرسِ یک سفارش — سندِ مستقل روی URLِ خودش.
 *
 * امنیت: این مسیر زیرِ `/p-admin` نیست، پس middleware به آن نمی‌رسد. گیت
 * *همین‌جا* و روی سرور انجام می‌شود (`getAdminContext` + `orders.view`) و
 * نتیجه‌ی رد، `notFound()` است تا وجودِ صفحه هم لو نرود. هیچ داده‌ای بدونِ
 * عبور از این گیت رندر نمی‌شود.
 *
 * ⚠️ فقط می‌خوانَد. هیچ فیلدی از سفارش — آدرس، قیمت تومان/یورو، اقلام، وضعیت —
 * اینجا نوشته نمی‌شود، و آدرسِ فرستنده هرگز روی سفارش ذخیره نمی‌شود؛ فقط یک
 * پارامترِ URL است.
 */

import { notFound } from "next/navigation";
import mongoose from "mongoose";

import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Order from "base/models/Order";
import SenderAddress from "base/models/SenderAddress";

import { getAdminContext } from "@/lib/adminContext";
import { hasPermission } from "@/lib/permissions";
import AddressSheet from "@/components/print/AddressSheet";
import AddressSheetStyles from "@/components/print/AddressSheetStyles";
import PrintToolbar from "@/components/print/PrintToolbar";

export const metadata = {
  title: "برگه آدرس سفارش",
  robots: { index: false, follow: false, nocache: true },
};

function formatDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export default async function OrderPrintPage({ params, searchParams }) {
  const { orderId } = await params;
  const { sender: senderId } = (await searchParams) || {};

  // ⚠️ همان کلیدی که GET /api/admin/orders/[orderId] با آن گیت شده — این صفحه
  // زیرمجموعه‌ی همان داده است. `hasPermission` مستقیم از رجیستری می‌آید تا این
  // مسیر به جدولِ روت‌های `/p-admin` (که این صفحه عمداً در آن نیست) وابسته نشود.
  const ctx = await getAdminContext();
  if (!ctx || !hasPermission(ctx.permissions, "orders.view")) notFound();

  if (!mongoose.Types.ObjectId.isValid(orderId)) notFound();

  await connectToDB();

  const order = await Order.findById(orderId)
    .select("trackingCode address createdAt")
    .lean();
  if (!order) notFound();

  // آدرسِ فرستنده اختیاری است: اگر پاک شده باشد یا انتخاب نشده باشد، برگه با
  // بخشِ فرستنده‌ی خالی چاپ می‌شود، نه خطا.
  const sender =
    senderId && mongoose.Types.ObjectId.isValid(senderId)
      ? await SenderAddress.findById(senderId)
          .select("title fullName phone province city addressLine postalCode")
          .lean()
      : null;

  const recipient = order.address?.snapshot || null;

  return (
    <>
      <AddressSheetStyles />
      {/* بدونِ آدرسِ گیرنده چیزی برای چاپ نیست — دیالوگ هم باز نمی‌شود. */}
      {recipient ? <PrintToolbar auto /> : null}
      {recipient ? (
        <AddressSheet
          sender={sender}
          recipient={recipient}
          trackingCode={order.trackingCode || String(order._id)}
          orderDate={formatDate(order.createdAt)}
        />
      ) : (
        <p className="empty">
          این سفارش آدرس تحویلی ثبت‌شده ندارد، پس برگه‌ی آدرس قابل چاپ نیست.
        </p>
      )}
    </>
  );
}
