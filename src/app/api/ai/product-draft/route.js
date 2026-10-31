import "base/models/registerModels";
import connectToDB from "base/configs/db";

import { buildProductDraftPrompt } from "@/lib/productDraftPrompt";
import requireAdminPermission from "@/lib/requireAdminPermission";

export async function POST(req) {
  const { denied } = await requireAdminPermission("ai.productDraft");
  if (denied) return denied;

  try {
    await connectToDB();

    const { categoryId, rawContent } = await req.json();
    if (!categoryId || !rawContent) {
      return Response.json(
        { error: "categoryId and rawContent are required" },
        { status: 400 }
      );
    }

    // همان سازنده‌ای که بازتولیدِ خودکار با آن مستقیم از AI می‌پرسد (src/lib/productDraftPrompt.js)
    const result = await buildProductDraftPrompt({ categoryId, rawContent });
    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json(
      { draft: result.prompt, meta: { ...result.meta, aiModel: "gpt-4.1-mini" } },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
