import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDB from "base/configs/db";
import "base/models/registerModels";
import SiteSetting from "base/models/SiteSetting";
import User from "base/models/User";
import { verifyToken } from "base/utils/auth";
import {
  BANK_ACCOUNT_SETTING_KEY,
  normalizeBankAccountDetails,
} from "base/utils/bankAccountDetails";

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Vary: "Cookie",
};

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}

/**
 * Customer-facing, read-only endpoint for bank-receipt payments.
 *
 * Deliberately accepts no setting key and returns only a whitelisted projection
 * of bank_account_details. The generic site-settings API remains admin-only.
 */
export async function GET() {
  try {
    const token = (await cookies()).get("accessToken")?.value;
    if (!token) return json({ message: "احراز هویت لازم است" }, 401);

    const decoded = verifyToken(token);
    if (!decoded?.userId || !mongoose.isObjectIdOrHexString(decoded.userId)) {
      return json({ message: "نشست کاربری معتبر نیست" }, 401);
    }

    await connectToDB();

    // A valid signature alone is not enough: ensure the account still exists
    // and has not been banned since the token was issued.
    const userExists = await User.exists({
      _id: decoded.userId,
      isBanned: { $ne: true },
    });
    if (!userExists) return json({ message: "نشست کاربری معتبر نیست" }, 401);

    const setting = await SiteSetting.findOne({ key: BANK_ACCOUNT_SETTING_KEY })
      .select("value -_id")
      .lean();

    return json({ value: normalizeBankAccountDetails(setting?.value) });
  } catch (error) {
    console.error("[payments/bank-details GET]", error);
    return json({ message: "دریافت اطلاعات حساب بانکی انجام نشد" }, 500);
  }
}
