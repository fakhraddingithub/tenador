import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Event from "base/models/Event";
import { revalidateContent } from "@/lib/revalidate";

// POST /api/admin/events/:id/duplicate
export async function POST(req, { params }) {
  await connectToDB();

  const { id } = await params;
  const source = await Event.findById(id).lean();
  if (!source) return NextResponse.json({ error: "Collection یافت نشد" }, { status: 404 });

  const { _id, createdAt, updatedAt, ...rest } = source;

  const baseSlug = `${rest.slug}-copy`;
  let slug = baseSlug;
  let counter = 1;
  while (await Event.exists({ slug })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const clone = await Event.create({
    ...rest,
    name: `${rest.name} (کپی)`,
    slug,
    status: "draft",
    clonedFrom: _id,
    isTemplate: false,
  });

  revalidateContent(["events"]);
  return NextResponse.json(clone, { status: 201 });
}
