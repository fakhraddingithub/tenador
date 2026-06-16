import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { resolveEventProducts } from "base/services/eventProductResolver";

// POST /api/admin/events/preview-products
// Resolves a productSelection payload without needing a saved event — used by
// the admin form to preview which products an event's rules will match.
export async function POST(req) {
  await connectToDB();
  const body = await req.json();
  const productSelection = body?.productSelection || {};

  const products = await resolveEventProducts(productSelection);
  return NextResponse.json({
    products: products.slice(0, 24),
    total: products.length,
  });
}
