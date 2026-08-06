import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Address from "base/models/Address";
import { cookies } from "next/headers";
import { verifyToken } from "base/utils/auth";

export async function PATCH(req, { params }) {
  try {
    await connectToDB();

    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    const userId = verifyToken(token)?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "برای تغییر آدرس پیش‌فرض وارد حساب کاربری شوید" },
        { status: 401 }
      );
    }

    // 1️⃣ بررسی وجود آدرس
    const address = await Address.findById(id);
    if (!address) {
      return NextResponse.json(
        { error: "Address not found" },
        { status: 404 }
      );
    }

    // 2️⃣ مالکیت (خیلی مهم)
    if (address.user.toString() !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // 3️⃣ همه آدرس‌های کاربر ← false
    await Address.updateMany(
      { user: userId },
      { $set: { isDefault: false } }
    );

    // 4️⃣ این آدرس ← true
    address.isDefault = true;
    await address.save();

    return NextResponse.json({
      message: "Default address updated",
      address,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
