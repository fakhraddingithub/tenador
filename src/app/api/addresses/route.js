import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Address from "base/models/Address";
import { cookies } from 'next/headers';
import { verifyToken } from "base/utils/auth";
import {
  firstAddressError,
  normalizePhoneInput,
  validateAddressPayload,
} from "@/lib/addressForm.mjs";
import { joinAddressName } from "@/lib/addressName.mjs";

export async function GET(req) {
  try {
    await connectToDB();
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    
    const user = verifyToken(token)
    if (!user?.userId) {
      return NextResponse.json({ error: "برای مشاهده آدرس‌ها وارد حساب کاربری شوید" }, { status: 401 });
    }
    
    const addresses = await Address.find({
      user: user.userId
    }).select('-__v');
    return NextResponse.json({ addresses });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectToDB();
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    
    const userAuth = verifyToken(token)
    if (!userAuth?.userId) {
      return NextResponse.json({ error: "برای ثبت آدرس وارد حساب کاربری شوید" }, { status: 401 });
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
        { user: userAuth.userId },
        { $set: { isDefault: false } }
      );
    }

    const newAddress = new Address({
      user:userAuth.userId,
      title: title?.trim() || "",
      fullName: firstName !== undefined || lastName !== undefined
        ? joinAddressName(firstName || "", lastName || "")
        : fullName.trim(),
      phone: normalizePhoneInput(phone),
      city: city.trim(),
      addressLine: addressLine.trim(),
      postalCode: postalCode?.trim() || "",
      isDefault: !!isDefault,
    });

    await newAddress.save();
    return NextResponse.json({ address: newAddress }, { status: 201 });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
