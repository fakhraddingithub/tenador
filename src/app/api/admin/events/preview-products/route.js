import { NextResponse } from "next/server";
import connectToDB from "base/configs/db";
import { resolveEventProducts } from "base/services/eventProductResolver";

import requireAdminPermission from "@/lib/requireAdminPermission";

// POST /api/admin/events/preview-products
// Resolves a productSelection payload without needing a saved event — used by
// the admin form to preview which products an event's rules will match.
export async function POST(req) {
  const { denied } = await requireAdminPermission("collections.view");
  if (denied) return denied;

  await connectToDB();
  const body = await req.json();
  const productSelection = body?.productSelection || {};

  // No display cap — the admin reviews (and re-orders) the full resolved list.
  const products = await resolveEventProducts(productSelection);
  return NextResponse.json({ products, total: products.length });
}
