/**
 * src/app/api/product/[productId]/regenerate/route.js
 *
 * POST { json: string, dryRun?: boolean, expectedUpdatedAt?: string }
 *
 * پیش‌نمایش/اعمالِ بازتولید از یک JSON — همه‌ی فیلدها به‌جز تصاویر و واریانت‌ها.
 * هر دو حالت به اینجا ختم می‌شوند: حالتِ دستی JSONِ چسبانده‌شده را می‌فرستد و
 * حالتِ خودکار JSONی را که /regenerate/generate از مدل گرفت. یعنی خروجیِ AI هیچ
 * مسیرِ نوشتنِ جداگانه‌ای ندارد و همیشه از نو اعتبارسنجی می‌شود.
 *
 * - `dryRun: true` → فقط پیش‌نمایش ({ changes, slug, missing, ignored, preserved, updatedAt }).
 * - اعمال `expectedUpdatedAt`ِ همان پیش‌نمایش را می‌خواهد (۴۰۹ اگر محصول عوض شده باشد).
 * منطق در src/lib/productRegenerationService.js و src/lib/productRegeneration.js.
 */

import "base/models/registerModels";
import { NextResponse } from "next/server";

import connectToDB from "base/configs/db";
import { parseRegenerationDraft } from "@/lib/productRegeneration";
import {
  loadRegenerationTarget,
  previewRegeneration,
  applyRegeneration,
} from "@/lib/productRegenerationService";
import { revalidateContent } from "@/lib/revalidate";
import { apiError, handleApiError } from "@/lib/apiError";
import requireAdminPermission from "@/lib/requireAdminPermission";

const respond = ({ message, status, extra }) => apiError(message, status, extra);

export async function POST(request, { params }) {
  const { denied } = await requireAdminPermission("products.edit");
  if (denied) return denied;

  try {
    const { productId } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("درخواست نامعتبر است", 400);
    }

    const parsed = parseRegenerationDraft(body.json);
    if (parsed.error) return apiError(parsed.error, 400);

    await connectToDB();

    const target = await loadRegenerationTarget(productId);
    if (target.error) return respond(target.error);

    const result = await previewRegeneration({ ...target, draft: parsed.draft });
    if (result.error) return respond(result.error);
    const { plan, preview } = result;

    if (body.dryRun) return NextResponse.json(preview, { status: 200 });

    const applied = await applyRegeneration({
      productId, plan, preview, expectedUpdatedAt: body.expectedUpdatedAt,
    });
    if (applied.error) return respond(applied.error);

    revalidateContent(["products", "navbar"]);

    return NextResponse.json(
      { message: "محصول با موفقیت بازتولید شد", ...preview, updatedAt: undefined },
      { status: 200 },
    );
  } catch (err) {
    return handleApiError(err, "خطا در بازتولید محصول");
  }
}
