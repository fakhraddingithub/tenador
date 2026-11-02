import "base/models/registerModels";
import connectToDB from "base/configs/db";

import requireAdminPermission from "@/lib/requireAdminPermission";
import { buildFinalPromptPreview } from "@/lib/productDraftPrompt";

// GET /api/admin/product-prompts/final-prompt?categoryId=… → { prompt }
// متنِ کاملِ پرامپت، همان که به AI می‌رسد، با PLACEHOLDER FOR SOURCE TEXT به‌جای متنِ منبع.
export async function GET(req) {
  const { denied } = await requireAdminPermission("productPrompts.view");
  if (denied) return denied;

  const categoryId = new URL(req.url).searchParams.get("categoryId") || "";
  if (!/^[a-f\d]{24}$/i.test(categoryId)) {
    return Response.json({ error: "دسته‌ی نامعتبر" }, { status: 400 });
  }

  try {
    await connectToDB();
    const result = await buildFinalPromptPreview(categoryId);
    if (result.error) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ prompt: result.prompt });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "خطای سرور" }, { status: 500 });
  }
}
