// app/api/admin/discounts/route.js
import connectToDB from "base/configs/db";
import DiscountRule from "base/models/DiscountRule";
import { parseIranDateTimeLocal } from "@/lib/iranDateTime";
import { NextResponse } from "next/server";

import requireAdminPermission from "@/lib/requireAdminPermission";

// GET /api/admin/discounts  → لیست قوانین تخفیف
export async function GET(req) {
  const { denied } = await requireAdminPermission("discounts.view");
  if (denied) return denied;

  await connectToDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const type = searchParams.get("type");
  const active = searchParams.get("active");

  const filter = {};
  if (type) filter.type = type;
  if (active !== null && active !== "") filter.active = active === "true";

  const [rules, total] = await Promise.all([
    DiscountRule.find(filter)
      .sort({ priority: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    DiscountRule.countDocuments(filter),
  ]);

  return NextResponse.json({ rules, total, page, pages: Math.ceil(total / limit) });
}

// POST /api/admin/discounts  → ساخت قانون جدید
export async function POST(req) {
  const { denied } = await requireAdminPermission("discounts.create");
  if (denied) return denied;

  await connectToDB();
  const body = await req.json();

  // اعتبارسنجی پایه
  const required = ["title", "type", "discount", "startAt", "endAt"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `فیلد ${field} الزامی است` }, { status: 400 });
    }
  }

  const startAt = parseIranDateTimeLocal(body.startAt);
  const endAt = parseIranDateTimeLocal(body.endAt);

  if (!startAt || !endAt) {
    return NextResponse.json({ error: "تاریخ شروع یا پایان نامعتبر است" }, { status: 400 });
  }

  if (startAt >= endAt) {
    return NextResponse.json({ error: "تاریخ شروع باید قبل از تاریخ پایان باشد" }, { status: 400 });
  }

  if (body.discount.value <= 0) {
    return NextResponse.json({ error: "مقدار تخفیف باید بیشتر از صفر باشد" }, { status: 400 });
  }

  if (body.discount.kind === "percent" && body.discount.value > 100) {
    return NextResponse.json({ error: "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد" }, { status: 400 });
  }

  const rule = await DiscountRule.create({ ...body, startAt, endAt });
  return NextResponse.json(rule, { status: 201 });
}
