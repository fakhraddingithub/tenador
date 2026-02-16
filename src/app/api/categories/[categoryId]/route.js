import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    await connectToDB();
    const { categoryId } = await params;
    const category = await Category.findById(categoryId).populate('parent').lean();

    if (!category) {
      return NextResponse.json(
        { error: "دسته‌بندی پیدا نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json({ category });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await connectToDB();
    const { categoryId } = await params;
    const body = await req.json();
    const { title, name, parent, attributes, technicalStats, prompts } = body;

    const category = await Category.findById(categoryId);
    if (!category) {
      return NextResponse.json({ error: "دسته‌بندی پیدا نشد" }, { status: 404 });
    }

    // به‌روزرسانی فیلدهای متنی پایه
    if (title?.trim()) category.title = title.trim();
    
    if (name?.trim()) {
      // بررسی اعتبار فرمت نام جدید
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
        return NextResponse.json({ error: "فرمت نام انگلیسی نامعتبر است" }, { status: 400 });
      }
      category.name = name.trim();
    }

    // به‌روزرسانی والد
    if (parent !== undefined) {
      category.parent = parent || null;
    }

    // به‌روزرسانی ویژگی‌های جدول (Attributes)
    if (attributes !== undefined) {
      if (Array.isArray(attributes)) {
        category.attributes = attributes;
      }
    }

    // به‌روزرسانی شاخص‌های نمودار (Technical Stats) - فیلد جدید
    if (technicalStats !== undefined) {
      if (Array.isArray(technicalStats)) {
        // اعتبارسنجی مختصر قبل از ذخیره
        const isValid = technicalStats.every(stat => stat.name && stat.label);
        if (!isValid) {
          return NextResponse.json({ error: "تمام شاخص‌های فنی باید نام و برچسب داشته باشند" }, { status: 400 });
        }
        category.technicalStats = technicalStats;
      }
    }

    // به‌روزرسانی پرامپت‌ها
    if (prompts !== undefined) {
      category.prompts = prompts;
    }

    await category.save();

    return NextResponse.json({
      message: "دسته‌بندی با موفقیت به‌روزرسانی شد",
      category,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const { categoryId } =await params;
    
    const category = await Category.findByIdAndDelete(categoryId);
    if (!category) {
      return NextResponse.json(
        { error: "دسته‌بندی پیدا نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "دسته‌بندی با موفقیت حذف شد",
    });
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}