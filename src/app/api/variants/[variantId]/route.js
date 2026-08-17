import connectToDB from "base/configs/db";
import Variant from "base/models/Variant";
import Product from "base/models/Product";
import { NextResponse } from "next/server";
import requireAdminPermission from "@/lib/requireAdminPermission";
import { revalidateContent } from "@/lib/revalidate";

// ⚠️ همان مورد روتِ api/product/[productId]/variants: در Next 16، params یک
// Promise است. اصلاحِ `await params()` و افزودنِ requireAdmin تفکیک‌ناپذیرند —
// باگِ params تنها چیزی است که فعلاً جلوی حذفِ واریانت بدونِ احراز هویت را گرفته.

export async function DELETE(req, { params }) {
  const { denied } = await requireAdminPermission("variants.edit");
  if (denied) return denied;

  try {
    await connectToDB();
    const resolvedParams = await params;
    const variantId = resolvedParams.variantId || resolvedParams.id;
    
    const variant = await Variant.findById(variantId);
    if (!variant) {
      return NextResponse.json(
        { error: "واریانت پیدا نشد" },
        { status: 404 }
      );
    }

    // حذف واریانت از محصول
    await Product.findByIdAndUpdate(variant.productId, {
      $pull: { variants: variantId },
    });

    // حذف واریانت
    await Variant.findByIdAndDelete(variantId);

    revalidateContent(["products"]);

    return NextResponse.json({
      message: "واریانت با موفقیت حذف شد",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}














