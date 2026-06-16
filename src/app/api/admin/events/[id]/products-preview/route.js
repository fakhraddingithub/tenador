import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import Event from "base/models/Event";
import { resolveEventProducts } from "base/services/eventProductResolver";

// GET /api/admin/events/:id/products-preview
// Returns resolved product list for the event's selection rules (admin preview)
export async function GET(req, { params }) {
  await connectToDB();

  const { id } = await params;
  const event = await Event.findById(id).select("productSelection").lean();
  if (!event) return NextResponse.json({ error: "رویداد یافت نشد" }, { status: 404 });

  const products = await resolveEventProducts(event.productSelection);
  return NextResponse.json({ products, total: products.length });
}
