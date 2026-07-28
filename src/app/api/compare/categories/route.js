import { NextResponse } from "next/server";
import { getCompareCategories } from "base/services/compareCategory.service";

export async function GET() {
  try {
    const categories = await getCompareCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Compare categories API error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
