import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import HealthCard from "base/models/HealthCard";
import Category from "base/models/Category";

export async function GET() {
  try {
    await connectToDB();
    const cards = await HealthCard.find()
      .populate("category", "title slug")
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ cards });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await connectToDB();
    const body = await req.json();
    const { category, fields } = body;

    if (!category) {
      return NextResponse.json({ error: "دسته‌بندی الزامی است" }, { status: 400 });
    }

    // Unique keys check
    const keys = (fields || []).map((f) => f.key);
    if (new Set(keys).size !== keys.length) {
      return NextResponse.json({ error: "کلیدهای تکراری در fields" }, { status: 400 });
    }

    // One per category
    const existing = await HealthCard.findOne({ category });
    if (existing) {
      return NextResponse.json(
        { error: "این دسته‌بندی قبلاً HealthCard دارد" },
        { status: 409 }
      );
    }

    const card = await HealthCard.create({ category, fields: fields || [] });
    return NextResponse.json({ card }, { status: 201 });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return NextResponse.json(
        { error: "این دسته‌بندی قبلاً HealthCard دارد" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}