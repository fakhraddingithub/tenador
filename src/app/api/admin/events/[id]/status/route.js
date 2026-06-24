import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Event from "base/models/Event";
import { revalidateContent } from "@/lib/revalidate";

const VALID_STATUSES = ["draft", "scheduled", "active", "paused", "ended", "archived"];

// PUT /api/admin/events/:id/status
export async function PUT(req, { params }) {
  await connectToDB();
  const { id } = await params;
  const { status } = await req.json();

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
  }

  const event = await Event.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  ).lean();

  if (!event) return NextResponse.json({ error: "Collection یافت نشد" }, { status: 404 });

  revalidateContent(["events"]);
  return NextResponse.json(event);
}
