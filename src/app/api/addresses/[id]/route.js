import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Address from "base/models/Address";
import { cookies } from "next/headers";
import { verifyToken } from "base/utils/auth";
import {
  firstAddressError,
  normalizePhoneInput,
  validateAddressPayload,
} from "@/lib/addressForm.mjs";
import { joinAddressName } from "@/lib/addressName.mjs";

async function getCurrentUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  return verifyToken(token)?.userId || null;
}

export async function GET(req, { params }) {
  try {
    await connectToDB();
    const { id } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "برای مشاهده آدرس وارد حساب کاربری شوید" }, { status: 401 });
    }
    const address = await Address.findOne({ _id: id, user: userId });
    if (!address) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    return NextResponse.json({ address });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();
    const { id } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "برای ویرایش آدرس وارد حساب کاربری شوید" }, { status: 401 });
    }
    const body = await req.json();
    const { title, firstName, lastName, fullName, phone, city, addressLine, postalCode, isDefault } = body;
    const fieldErrors = validateAddressPayload(body);

    if (Object.keys(fieldErrors).length) {
      return NextResponse.json(
        { error: firstAddressError(fieldErrors), fieldErrors },
        { status: 400 },
      );
    }

    // 🔥 ENFORCE SINGLE DEFAULT
    if (isDefault) {
      await Address.updateMany(
        { user: userId },
        { $set: { isDefault: false } }
      );
    }

    const updatedAddress = await Address.findOneAndUpdate(
      { _id: id, user: userId },
      {
        title: title?.trim() || "",
        fullName: firstName !== undefined || lastName !== undefined
          ? joinAddressName(firstName || "", lastName || "")
          : fullName.trim(),
        phone: normalizePhoneInput(phone),
        city: city.trim(),
        addressLine: addressLine.trim(),
        postalCode: postalCode?.trim() || "",
        isDefault: !!isDefault,
      },
      { new: true, runValidators: true }
    );

    if (!updatedAddress) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    return NextResponse.json({ address: updatedAddress });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const { id } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "برای حذف آدرس وارد حساب کاربری شوید" }, { status: 401 });
    }
    const deletedAddress = await Address.findOneAndDelete({ _id: id, user: userId });
    if (!deletedAddress) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Address deleted successfully" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
