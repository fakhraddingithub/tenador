/**
 * POST /api/admin/notifications/[id]/read
 * یک اعلان را خوانده‌شده علامت می‌زند و شمارش به‌روز را برمی‌گرداند.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import { verifyToken } from "base/utils/auth";
import Notification from "base/models/Notification";
import { getNotificationCounts } from "base/services/notificationService";

async function getAdminUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  if (!token) return null;
  return verifyToken(token) || null;
}

export async function POST(req, { params }) {
  try {
    await connectToDB();

    const admin = await getAdminUser();
    if (!admin?.userId) {
      return NextResponse.json({ message: "احراز هویت لازم است" }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "شناسه نامعتبر است" }, { status: 400 });
    }

    // فقط در صورتی که هنوز خوانده‌نشده باشد آپدیت می‌شود — جلوگیری از تغییر readAt تکراری
    await Notification.updateOne(
      { _id: id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    const counts = await getNotificationCounts();
    return NextResponse.json({ message: "خوانده شد", counts }, { status: 200 });
  } catch (error) {
    console.error("[admin/notifications/:id/read POST]", error);
    return NextResponse.json({ message: "خطای داخلی سرور" }, { status: 500 });
  }
}
