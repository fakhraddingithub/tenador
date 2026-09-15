import "base/models/registerModels";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import Brand from "base/models/Brand";
import Athlete from "base/models/Athlete";
import LimitedEdition from "base/models/LimitedEdition";

import { buildProductTemplate } from "@/lib/buildProductTemplate";
import requireAdminPermission from "@/lib/requireAdminPermission";

export async function POST(req) {
  const { denied } = await requireAdminPermission("ai.productDraft");
  if (denied) return denied;

  try {
    await connectToDB();

    const body = await req.json();
    const { categoryId, rawContent } = body;

    if (!categoryId || !rawContent) {
      return Response.json(
        { error: "categoryId and rawContent are required" },
        { status: 400 }
      );
    }

    // 1. Load category
    const category = await Category.findById(categoryId)
      .populate({ path: "sport", select: "name title" })
      .lean();
    if (!category) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    if (!category.sport?._id || !category.sport.name?.trim()) {
      return Response.json(
        { error: "ورزش اصلی این دسته‌بندی معتبر نیست؛ ابتدا ورزش دسته‌بندی را اصلاح کنید" },
        { status: 400 }
      );
    }

    // 2. Load reference lists; sport comes only from the selected category.
    const brands = await Brand.find({}, { name: 1 }).populate("series").lean();
    const athletes = await Athlete.find({}, { name: 1 }).lean();
    // brand لازم است تا قیدِ «ادیشن ← برند مالک» به مدل داده شود؛ بدونِ آن مدل
    // می‌توانست ادیشنِ یک برند را به محصولِ برندِ دیگری بچسباند.
    const limitedEditions = await LimitedEdition.find({}, { name: 1, title: 1, brand: 1 })
      .populate({ path: "brand", select: "name" })
      .lean();

    if (!brands.length) {
      return Response.json(
        { error: "Brands not configured" },
        { status: 500 }
      );
    }

    // 3. Build AI prompt
    const prompt = buildProductTemplate({
      category,
      brands,
      athletes,
      limitedEditions,
      rawContent,
    });

    
    return Response.json(
      {
        draft: prompt,
        meta: {
          category: category.title,
          categoryId: category._id.toString(),
          sport: {
            id: category.sport._id.toString(),
            name: category.sport.name,
            title: category.sport.title,
          },
          aiModel: "gpt-4.1-mini",
        },
      },
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
