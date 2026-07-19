/**
 * src/app/api/tickets/[id]/route.js
 *
 * GET   → جزئیات یک تیکتِ خودِ کاربر + تاریخچه‌ی کامل پیام‌ها
 * PATCH → { action: "close" | "reopen" } — بستن/بازکردن مجدد توسط کاربر
 *
 * تیکت بسته حذف نمی‌شود؛ تاریخچه همیشه قابل مشاهده است (فقط ارسال پیام مسدود می‌شود).
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import "base/models/registerModels";
import Ticket from "base/models/Ticket";
import TicketMessage from "base/models/TicketMessage";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function GET(req, { params }) {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { message: "احراز هویت لازم است" },
        { status: 401 },
      );
    }

    const { id } = await params;

    // مالکیت در خودِ کوئری اعمال می‌شود — تیکتِ کاربر دیگر هرگز برنمی‌گردد
    const ticket = await Ticket.findOne({ _id: id, user: user.userId })
      .populate("relatedOrder", "trackingCode totalPrice paymentStatus createdAt")
      .populate("relatedPayment", "amount status method createdAt")
      .populate("assignedAdmin", "name lastName")
      .lean();

    if (!ticket) {
      return NextResponse.json(
        { message: "تیکت یافت نشد" },
        { status: 404 },
      );
    }

    const messages = await TicketMessage.find({ ticket: ticket._id })
      .sort({ createdAt: 1 })
      .populate("sender", "name lastName avatar")
      .lean();

    return NextResponse.json({ ticket, messages }, { status: 200 });
  } catch (error) {
    console.error("[GET Ticket Error]:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور در دریافت تیکت" },
      { status: 500 },
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    await connectToDB();

    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json(
        { message: "احراز هویت لازم است" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const { action } = await req.json();

    const ticket = await Ticket.findOne({ _id: id, user: user.userId });
    if (!ticket) {
      return NextResponse.json(
        { message: "تیکت یافت نشد" },
        { status: 404 },
      );
    }

    if (action === "close") {
      if (ticket.status === "closed") {
        return NextResponse.json(
          { message: "تیکت قبلاً بسته شده است" },
          { status: 400 },
        );
      }
      ticket.status = "closed";
      ticket.closedBy = "user";
      ticket.closedAt = new Date();
      await ticket.save();
      return NextResponse.json({ ticket }, { status: 200 });
    }

    if (action === "reopen") {
      if (ticket.status !== "closed") {
        return NextResponse.json(
          { message: "تیکت بسته نیست" },
          { status: 400 },
        );
      }
      ticket.status = "open";
      ticket.closedBy = null;
      ticket.closedAt = null;
      await ticket.save();
      return NextResponse.json({ ticket }, { status: 200 });
    }

    return NextResponse.json(
      { message: "عملیات نامعتبر است" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[PATCH Ticket Error]:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور" },
      { status: 500 },
    );
  }
}
