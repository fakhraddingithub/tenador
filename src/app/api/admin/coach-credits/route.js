// app/api/admin/coach-credits/route.js
import connectToDB from "base/configs/db";
import CoachCredit from "base/models/CoachCredit";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

function getAdminFromRequest(req) {
  const token =
    req.cookies.get("token")?.value ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

// GET /api/admin/coach-credits
export async function GET(req) {
  const admin = getAdminFromRequest(req);
  // if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDB();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const active = searchParams.get("active");

  const filter = {};
  if (active !== null && active !== "") filter.active = active === "true";

  const [rules, total] = await Promise.all([
    CoachCredit.find(filter)
      .populate("coach", "name phone coachCode")
      .sort({ priority: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CoachCredit.countDocuments(filter),
  ]);

  return NextResponse.json({ rules, total, page, pages: Math.ceil(total / limit) });
}

// POST /api/admin/coach-credits
export async function POST(req) {
  const admin = getAdminFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDB();
  const body = await req.json();

  const required = ["title", "targetType", "credit"];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `فیلد ${field} الزامی است` }, { status: 400 });
    }
  }

  if (body.credit.value <= 0) {
    return NextResponse.json({ error: "مقدار کردیت باید بیشتر از صفر باشد" }, { status: 400 });
  }

  if (body.credit.kind === "percent" && body.credit.value > 100) {
    return NextResponse.json({ error: "درصد کردیت نمی‌تواند بیشتر از ۱۰۰ باشد" }, { status: 400 });
  }

  if (body.scope === "specific_coach" && !body.coach) {
    return NextResponse.json({ error: "مربی خاص را انتخاب کنید" }, { status: 400 });
  }

  const rule = await CoachCredit.create(body);
  return NextResponse.json(rule, { status: 201 });
}
