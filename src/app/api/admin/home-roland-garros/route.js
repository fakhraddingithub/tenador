import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import connectToDB from "base/configs/db";
import SiteSetting from "base/models/SiteSetting";
import { revalidateContent } from "@/lib/revalidate";
import {
  normalizeRolandGarrosBanner,
  validateRolandGarrosBanner,
  ROLAND_GARROS_BANNER_CACHE_TAG,
  ROLAND_GARROS_BANNER_SETTING_KEY,
} from "@/lib/rolandGarrosBanner";

export async function GET() {
  try {
    await connectToDB();
    const setting = await SiteSetting.findOne({
      key: ROLAND_GARROS_BANNER_SETTING_KEY,
    }).lean();

    return NextResponse.json({
      banner: normalizeRolandGarrosBanner(setting?.value),
      saved: Boolean(setting),
    });
  } catch (err) {
    console.error("home-roland-garros GET error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { banner, errors } = validateRolandGarrosBanner(body?.banner);

    if (errors.length) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    await connectToDB();
    await SiteSetting.findOneAndUpdate(
      { key: ROLAND_GARROS_BANNER_SETTING_KEY },
      { value: banner },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    revalidateContent([ROLAND_GARROS_BANNER_CACHE_TAG]);
    try {
      revalidatePath("/");
    } catch {
      // در محیط‌هایی که revalidatePath در دسترس نیست بی‌صدا رد شو
    }

    return NextResponse.json({ banner });
  } catch (err) {
    console.error("home-roland-garros PUT error:", err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
