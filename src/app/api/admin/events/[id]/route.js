import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Event from "base/models/Event";
import { revalidateContent } from "@/lib/revalidate";

// GET /api/admin/events/:id
export async function GET(req, { params }) {
  await connectToDB();
  const { id } = await params;
  const event = await Event.findById(id).lean();
  if (!event) return NextResponse.json({ error: "Collection یافت نشد" }, { status: 404 });
  return NextResponse.json(event);
}

// PUT /api/admin/events/:id
export async function PUT(req, { params }) {
  await connectToDB();
  const { id } = await params;
  const body = await req.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "نام Collection الزامی است" }, { status: 400 });
  }

  // Prevent slug conflict with another event
  if (body.slug) {
    const conflict = await Event.findOne({
      slug: body.slug.toLowerCase().trim(),
      _id: { $ne: id },
    });
    if (conflict) {
      return NextResponse.json({ error: "این شناسه URL قبلاً استفاده شده است" }, { status: 409 });
    }
    body.slug = body.slug.toLowerCase().trim();
  }

  const event = await Event.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true,
  }).lean();

  if (!event) return NextResponse.json({ error: "Collection یافت نشد" }, { status: 404 });

  revalidateContent(["events"]);
  return NextResponse.json(event);
}

// DELETE /api/admin/events/:id
export async function DELETE(req, { params }) {
  await connectToDB();
  const { id } = await params;
  const event = await Event.findByIdAndDelete(id).lean();
  if (!event) return NextResponse.json({ error: "Collection یافت نشد" }, { status: 404 });

  revalidateContent(["events"]);
  return NextResponse.json({ success: true });
}
