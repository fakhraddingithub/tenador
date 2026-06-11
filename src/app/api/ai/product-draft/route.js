import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import Athlete from "base/models/Athlete";
import Collaboration from "base/models/Collaboration";

import { buildProductTemplate } from "@/lib/buildProductTemplate";

export async function POST(req) {
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
    const category = await Category.findById(categoryId).lean();
    if (!category) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    // 2. Load ALL brands & sports (real behavior)
    const brands = await Brand.find({}, { name: 1 }).populate("series").lean();
    const sports = await Sport.find({}, { name: 1 }).lean();
    const athletes = await Athlete.find({}, { name: 1 }).lean();
    const collaborations = await Collaboration.find({}, { name: 1, title: 1 }).lean();

    if (!brands.length || !sports.length) {
      return Response.json(
        { error: "Brands or sports not configured" },
        { status: 500 }
      );
    }

    // 3. Build AI prompt
    const prompt = buildProductTemplate({
      category,
      brands,
      sports,
      athletes,
      collaborations,
      rawContent,
    });

    
    return Response.json(
      {
        draft: prompt,
        meta: {
          category: category.title,
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
