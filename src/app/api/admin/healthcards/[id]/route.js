import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import connectToDB from "base/configs/db";
import HealthCard from "base/models/HealthCard";

export async function GET(_, { params }) {
  try {
    await connectToDB();
    const { id } = await params;
    const card = await HealthCard.findById(id)
      .populate("category", "title slug")
      .lean();
    if (!card) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
    return NextResponse.json({ card });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();
    const body = await req.json();
    const { fields } = body;
    const { id } = await params;
    // Unique keys check
    const keys = (fields || []).map((f) => f.key);
    if (new Set(keys).size !== keys.length) {
      return NextResponse.json({ error: "کلیدهای تکراری در fields" }, { status: 400 });
    }

    const card = await HealthCard.findByIdAndUpdate(
      id,
      { fields: fields || [] },
      { new: true, runValidators: true }
    ).populate("category", "title slug");

    if (!card) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

    // ترتیب جدید فیلدها روی صفحه‌ی لیست دست‌دوم (ISR) بازتاب پیدا کند
    try { revalidatePath("/second-hand"); } catch {}

    return NextResponse.json({ card });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  try {
    await connectToDB();
    const { id } = await params;
    const card = await HealthCard.findByIdAndDelete(id);
    if (!card) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}