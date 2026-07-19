/**
 * src/app/api/admin/tickets/[id]/route.js
 *
 * GET   → جزئیات کامل تیکت برای ادمین (کاربر، سفارش/پرداخت مرتبط، پیام‌ها)
 * PATCH → { action: "close" | "reopen" } — بستن (closedBy: admin) / بازکردن مجدد
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Ticket from "base/models/Ticket";
import TicketMessage from "base/models/TicketMessage";
import requireAdmin from "@/lib/requireAdmin";

export const runtime = "nodejs";

export async function GET(req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 });
    }

    await connectToDB();
    const { id } = await params;

    const ticket = await Ticket.findById(id)
      .populate("user", "name lastName phone email avatar createdAt")
      .populate("assignedAdmin", "name lastName")
      .populate(
        "relatedOrder",
        "trackingCode totalPrice paymentStatus fulfillmentStatus paymentMethod createdAt",
      )
      .populate("relatedPayment", "amount status method order createdAt")
      .lean();

    if (!ticket) {
      return NextResponse.json({ message: "تیکت یافت نشد" }, { status: 404 });
    }

    const messages = await TicketMessage.find({ ticket: ticket._id })
      .sort({ createdAt: 1 })
      .populate("sender", "name lastName avatar role")
      .lean();

    return NextResponse.json({ ticket, messages }, { status: 200 });
  } catch (error) {
    console.error("[GET Admin Ticket Error]:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور در دریافت تیکت" },
      { status: 500 },
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 });
    }

    await connectToDB();
    const { id } = await params;
    const { action } = await req.json();

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return NextResponse.json({ message: "تیکت یافت نشد" }, { status: 404 });
    }

    if (action === "close") {
      if (ticket.status === "closed") {
        return NextResponse.json(
          { message: "تیکت قبلاً بسته شده است" },
          { status: 400 },
        );
      }
      ticket.status = "closed";
      ticket.closedBy = "admin";
      ticket.closedAt = new Date();
      await ticket.save();
      return NextResponse.json({ ticket }, { status: 200 });
    }

    if (action === "reopen") {
      if (ticket.status !== "closed") {
        return NextResponse.json({ message: "تیکت بسته نیست" }, { status: 400 });
      }
      // بازکردن توسط ادمین یعنی گفتگو ادامه دارد و نوبتِ پاسخِ پشتیبانی است
      ticket.status = "open";
      ticket.closedBy = null;
      ticket.closedAt = null;
      await ticket.save();
      return NextResponse.json({ ticket }, { status: 200 });
    }

    return NextResponse.json({ message: "عملیات نامعتبر است" }, { status: 400 });
  } catch (error) {
    console.error("[PATCH Admin Ticket Error]:", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
