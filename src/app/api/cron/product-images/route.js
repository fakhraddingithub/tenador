import { NextResponse } from "next/server";
import ImageKit from "imagekit";
import connectToDB from "base/configs/db";
import { cleanupProductJobImages } from "@/lib/productJobs/imageCleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/product-images
 * Called by Vercel Cron only (Authorization: Bearer CRON_SECRET). Deletes images that product
 * jobs imported into ImageKit but no product ended up using.
 */
export async function GET(req) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectToDB();
  const imagekit = new ImageKit({ publicKey: process.env.IMAGEKIT_PUBLIC_KEY, privateKey: process.env.IMAGEKIT_PRIVATE_KEY, urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT });
  const result = await cleanupProductJobImages({ deleteFile: fileId => imagekit.deleteFile(fileId) });
  return NextResponse.json({ ok: true, ...result });
}
