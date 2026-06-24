import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Event from "base/models/Event";
import { revalidateContent } from "@/lib/revalidate";

// GET /api/admin/events
export async function GET(req) {
  await connectToDB();
  const { searchParams } = new URL(req.url);

  const status = searchParams.get("status");
  const isTemplate = searchParams.get("isTemplate");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "20"));

  const filter = {};
  if (status) filter.status = status;
  if (isTemplate !== null && isTemplate !== "") {
    filter.isTemplate = isTemplate === "true";
  } else {
    filter.isTemplate = { $ne: true };
  }

  const [events, total] = await Promise.all([
    Event.find(filter)
      .sort({ priority: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Event.countDocuments(filter),
  ]);

  return NextResponse.json({ events, total, page, pages: Math.ceil(total / limit) });
}

// POST /api/admin/events
export async function POST(req) {
  await connectToDB();
  const body = await req.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "نام Collection الزامی است" }, { status: 400 });
  }
  if (!body.slug?.trim()) {
    return NextResponse.json({ error: "شناسه URL الزامی است" }, { status: 400 });
  }

  const existing = await Event.findOne({ slug: body.slug.toLowerCase().trim() });
  if (existing) {
    return NextResponse.json({ error: "این شناسه URL قبلاً استفاده شده است" }, { status: 409 });
  }

  const event = await Event.create({
    ...body,
    slug: body.slug.toLowerCase().trim(),
  });

  revalidateContent(["events"]);
  return NextResponse.json(event, { status: 201 });
}
