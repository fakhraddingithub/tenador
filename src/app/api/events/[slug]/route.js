import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Event from "base/models/Event";
import { resolveEventProducts } from "base/services/eventProductResolver";

// GET /api/events/:slug — public event data + resolved products
export async function GET(req, { params }) {
  await connectToDB();

  const { slug } = await params;
  const event = await Event.findOne({ slug, status: "active" }).lean();
  if (!event) return NextResponse.json({ error: "رویداد یافت نشد" }, { status: 404 });

  const products = await resolveEventProducts(event.productSelection);
  return NextResponse.json({ event: JSON.parse(JSON.stringify(event)), products });
}
