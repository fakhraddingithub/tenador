/**
 * src/app/api/admin/tickets/[id]/messages/route.js
 *
 * POST → پاسخ ادمین روی یک تیکت.
 *  - اگر تیکت هنوز ادمینِ مسئول ندارد، همین ادمین assignedAdmin می‌شود.
 *  - وضعیت پیش‌فرض بعد از پاسخ: answered؛ با awaitUser=true → pending_user
 *    (وقتی ادمین اطلاعات تکمیلی از کاربر خواسته است).
 *  - فقط پاسخ ادمین برای کاربر ایمیل اعلان می‌فرستد (پیام‌های کاربر ایمیل ندارند).
 */

import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import Ticket from "base/models/Ticket";
import TicketMessage from "base/models/TicketMessage";
import User from "base/models/User";
import requireAdmin from "@/lib/requireAdmin";
import { sanitizeAttachments } from "@/lib/ticketUtils";
import { sendTicketReplyEmail } from "@/lib/emailService";

export const runtime = "nodejs";

export async function POST(req, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 });
    }

    await connectToDB();
    const { id } = await params;
    const payload = await req.json();
    const body = String(payload?.body || "").trim();
    const attachments = sanitizeAttachments(payload?.attachments);
    const awaitUser = payload?.awaitUser === true;

    if (!body && attachments.length === 0) {
      return NextResponse.json(
        { message: "متن پاسخ یا حداقل یک پیوست الزامی است" },
        { status: 400 },
      );
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return NextResponse.json({ message: "تیکت یافت نشد" }, { status: 404 });
    }
    if (ticket.status === "closed") {
      return NextResponse.json(
        { message: "این تیکت بسته شده است؛ برای پاسخ ابتدا آن را باز کنید" },
        { status: 400 },
      );
    }

    const message = await TicketMessage.create({
      ticket: ticket._id,
      sender: admin._id,
      senderRole: "admin",
      body,
      attachments,
    });

    // اولین پاسخ‌دهنده مسئولِ تیکت می‌شود
    if (!ticket.assignedAdmin) {
      ticket.assignedAdmin = admin._id;
    }
    ticket.status = awaitUser ? "pending_user" : "answered";
    ticket.lastMessageAt = new Date();
    await ticket.save();

    // ─── ایمیل اعلان برای کاربر (اگر ایمیل دارد) — خطای ایمیل پاسخ را متوقف نمی‌کند ───
    try {
      const customer = await User.findById(ticket.user).select("email").lean();
      if (customer?.email) {
        await sendTicketReplyEmail(ticket, body, attachments.length, customer.email);
      }
    } catch (emailError) {
      console.error("[Ticket Reply Email Error]:", emailError);
    }

    const populated = await TicketMessage.findById(message._id)
      .populate("sender", "name lastName avatar")
      .lean();

    return NextResponse.json({ message: populated }, { status: 201 });
  } catch (error) {
    console.error("[POST Admin Ticket Message Error]:", error);
    return NextResponse.json(
      { message: "خطای داخلی سرور در ارسال پاسخ" },
      { status: 500 },
    );
  }
}
