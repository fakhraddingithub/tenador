/**
 * src/app/api/tickets/route.js
 *
 * GET  → لیست تیکت‌های خودِ کاربر (مرتب بر اساس آخرین فعالیت)
 * POST → ثبت تیکت جدید + اولین پیام آن
 *
 * مالکیت: همه‌ی کوئری‌ها به user.userId محدود می‌شوند؛ ارجاعِ سفارش/پرداخت
 * فقط در صورتی پذیرفته می‌شود که متعلق به همین کاربر باشد.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import "base/models/registerModels";
import Ticket from "base/models/Ticket";
import TicketMessage from "base/models/TicketMessage";
import Order from "base/models/Order";
import Payment from "base/models/Payment";
import {
  TICKET_DEPARTMENTS,
  TICKET_PRIORITIES,
} from "base/utils/ticketMeta";
import { sanitizeAttachments } from "@/lib/ticketUtils";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

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

    const tickets = await Ticket.find({ user: user.userId })
      .sort({ lastMessageAt: -1 })
      .populate("relatedOrder", "trackingCode")
      .populate("relatedPayment", "amount status")
      .lean();

    return NextResponse.json({ tickets }, { status: 200 });
  } catch (error) {
    console.error("[GET Tickets Error]:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور در دریافت تیکت‌ها" },
      { status: 500 },
    );
  }
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

    const payload = await req.json();
    const subject = String(payload?.subject || "").trim();
    const department = String(payload?.department || "");
    const priority = String(payload?.priority || "");
    const body = String(payload?.body || "").trim();
    const attachments = sanitizeAttachments(payload?.attachments);

    if (!subject || subject.length > 200) {
      return NextResponse.json(
        { message: "موضوع تیکت الزامی است (حداکثر ۲۰۰ کاراکتر)" },
        { status: 400 },
      );
    }
    if (!TICKET_DEPARTMENTS.includes(department)) {
      return NextResponse.json(
        { message: "دپارتمان انتخاب‌شده معتبر نیست" },
        { status: 400 },
      );
    }
    if (!TICKET_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { message: "اولویت انتخاب‌شده معتبر نیست" },
        { status: 400 },
      );
    }
    if (!body) {
      return NextResponse.json(
        { message: "متن پیام اولیه الزامی است" },
        { status: 400 },
      );
    }

    // ─── ارجاع اختیاری به سفارش/پرداخت — فقط متعلق به خودِ کاربر ───
    let relatedOrder = null;
    if (payload?.relatedOrder) {
      const order = await Order.findOne({
        _id: payload.relatedOrder,
        user: user.userId,
      })
        .select("_id")
        .lean();
      if (!order) {
        return NextResponse.json(
          { message: "سفارش انتخاب‌شده یافت نشد" },
          { status: 400 },
        );
      }
      relatedOrder = order._id;
    }

    let relatedPayment = null;
    if (payload?.relatedPayment) {
      const payment = await Payment.findById(payload.relatedPayment)
        .select("order")
        .lean();
      const owner = payment
        ? await Order.findOne({ _id: payment.order, user: user.userId })
            .select("_id")
            .lean()
        : null;
      if (!payment || !owner) {
        return NextResponse.json(
          { message: "پرداخت انتخاب‌شده یافت نشد" },
          { status: 400 },
        );
      }
      relatedPayment = payment._id;
    }

    const now = new Date();
    const ticket = await Ticket.create({
      user: user.userId,
      subject,
      department,
      priority,
      status: "open",
      relatedOrder,
      relatedPayment,
      lastMessageAt: now,
    });

    await TicketMessage.create({
      ticket: ticket._id,
      sender: user.userId,
      senderRole: "user",
      body,
      attachments,
    });

    return NextResponse.json({ ticket: { _id: ticket._id } }, { status: 201 });
  } catch (error) {
    console.error("[POST Ticket Error]:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور در ثبت تیکت" },
      { status: 500 },
    );
  }
}
