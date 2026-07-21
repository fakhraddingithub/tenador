/**
 * src/app/api/tickets/[id]/messages/route.js
 *
 * POST → ارسال پیام جدید توسط کاربر روی تیکتِ خودش.
 * پیام روی تیکت بسته مجاز نیست (ابتدا باید بازِ مجدد شود).
 * پیام کاربر وضعیت را به «در انتظار پاسخ» (open) برمی‌گرداند.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import "base/models/registerModels";
import Ticket from "base/models/Ticket";
import TicketMessage from "base/models/TicketMessage";
import { sanitizeAttachments } from "@/lib/ticketUtils";
import { notifyNewTicket } from "base/services/notificationService";

async function getUserFromToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function POST(req, { params }) {
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
    const payload = await req.json();
    const body = String(payload?.body || "").trim();
    const attachments = sanitizeAttachments(payload?.attachments);

    if (!body && attachments.length === 0) {
      return NextResponse.json(
        { message: "متن پیام یا حداقل یک پیوست الزامی است" },
        { status: 400 },
      );
    }

    const ticket = await Ticket.findOne({ _id: id, user: user.userId });
    if (!ticket) {
      return NextResponse.json(
        { message: "تیکت یافت نشد" },
        { status: 404 },
      );
    }
    if (ticket.status === "closed") {
      return NextResponse.json(
        { message: "این تیکت بسته شده است؛ برای ادامه ابتدا آن را باز کنید" },
        { status: 400 },
      );
    }

    const message = await TicketMessage.create({
      ticket: ticket._id,
      sender: user.userId,
      senderRole: "user",
      body,
      attachments,
    });

    ticket.status = "open";
    ticket.lastMessageAt = new Date();
    await ticket.save();

    // پاسخ کاربر → نیازِ رسیدگیِ ادمین → اعلانِ پنل (خطا بلعیده می‌شود)
    await notifyNewTicket(ticket, { reply: true });

    const populated = await TicketMessage.findById(message._id)
      .populate("sender", "name lastName avatar")
      .lean();

    return NextResponse.json({ message: populated }, { status: 201 });
  } catch (error) {
    console.error("[POST Ticket Message Error]:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور در ارسال پیام" },
      { status: 500 },
    );
  }
}
