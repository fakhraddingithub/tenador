import mongoose from "mongoose";
import connectToDB from "base/configs/db";
import Category from "base/models/Category";
import Sport from "base/models/Sport";
import { NextResponse } from "next/server";
import { revalidateContent } from "@/lib/revalidate";

// ---------------------------------------------------------
// GET: دریافت جزئیات یک کتگوری
// ---------------------------------------------------------
export async function GET(req, { params }) {
  try {
    await connectToDB();
    const { categoryId } = await params;
    const category = await Category.findById(categoryId)
      .populate('parent')
      .populate('sport', 'title name slug')
      .lean();

    if (!category) {
      return NextResponse.json({ error: "دسته‌بندی پیدا نشد" }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------
// PUT: ویرایش کامل کتگوری (با پشتیبانی از مدل جدید)
// ---------------------------------------------------------
export async function PUT(req, { params }) {
  try {
    await connectToDB();
    const { categoryId } = await params;
    const body = await req.json();
    const {
      title,
      name,
      sport,   // ورزشِ صاحبِ این دسته (الزامی)
      parent,
      attributes,
      variantAttributes, // فیلد جدید
      technicalStats,
      technicalStatsPrompt,
      prompts,
      image,
      icon
    } = body;

    const category = await Category.findById(categoryId);
    if (!category) {
      return NextResponse.json({ error: "دسته‌بندی پیدا نشد" }, { status: 404 });
    }

    // ۰. ورزشِ مقصد برای بررسی یکتاییِ اسلاگ/نام (مقدار جدید یا مقدار فعلی)
    if (sport !== undefined) {
      if (!sport || !mongoose.isValidObjectId(sport)) {
        return NextResponse.json({ error: "ورزش انتخاب‌شده معتبر نیست" }, { status: 400 });
      }
      const sportDoc = await Sport.findById(sport).select("_id").lean();
      if (!sportDoc) {
        return NextResponse.json({ error: "ورزش انتخاب‌شده معتبر نیست" }, { status: 400 });
      }
      category.sport = sport;
    }

    if (!category.sport) {
      return NextResponse.json({ error: "انتخاب ورزش برای دسته‌بندی الزامی است" }, { status: 400 });
    }

    // ۱. به‌روزرسانی فیلدهای پایه — یکتایی فقط در محدوده‌ی همین ورزش بررسی می‌شود
    if (title?.trim() || name?.trim()) {
      const dupOr = [];
      if (title?.trim()) dupOr.push({ title: title.trim() });
      if (name?.trim()) dupOr.push({ name: name.trim() });
      const duplicate = await Category.findOne({
        _id: { $ne: category._id },
        sport: category.sport,
        $or: dupOr,
      }).select("_id").lean();
      if (duplicate) {
        return NextResponse.json({ error: "دسته‌ای با این عنوان یا نام در این ورزش وجود دارد" }, { status: 409 });
      }
    }

    if (title?.trim()) category.title = title.trim();

    if (name?.trim()) {
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
        return NextResponse.json({ error: "فرمت نام انگلیسی نامعتبر است" }, { status: 400 });
      }
      category.name = name.trim();
    }

    if (parent !== undefined) {
      category.parent = parent || null;
    }

    // ۲. اعتبارسنجی و به‌روزرسانی ویژگی‌ها (Global & Variant)
    const validateAttrs = (list) => {
      if (!Array.isArray(list)) return false;
      const validUiTypes = ["text-input", "number-input", "dropdown", "swatch", "button-toggle"];
      return list.every(attr => 
        attr.name && 
        attr.label && 
        (!attr.uiType || validUiTypes.includes(attr.uiType))
      );
    };

    if (attributes !== undefined) {
      if (!validateAttrs(attributes)) {
        return NextResponse.json({ error: "ویژگی‌های عمومی (Attributes) نامعتبر هستند" }, { status: 400 });
      }
      category.attributes = attributes;
    }

    if (variantAttributes !== undefined) {
      if (!validateAttrs(variantAttributes)) {
        return NextResponse.json({ error: "ویژگی‌های واریانت نامعتبر هستند" }, { status: 400 });
      }
      category.variantAttributes = variantAttributes;
    }

    // ۳. به‌روزرسانی شاخص‌های فنی نمودار (Technical Stats) - با دقت کامل
    if (technicalStats !== undefined) {
      if (Array.isArray(technicalStats)) {
        for (const stat of technicalStats) {
          if (!stat.name || !stat.label) {
            return NextResponse.json({ error: "تمام شاخص‌های فنی باید نام و برچسب داشته باشند" }, { status: 400 });
          }
          if (stat.min !== undefined && stat.max !== undefined && Number(stat.min) >= Number(stat.max)) {
            return NextResponse.json({ error: `بازه عددی در '${stat.label}' نامعتبر است` }, { status: 400 });
          }
        }
        category.technicalStats = technicalStats;
      }
    }

    if (technicalStatsPrompt !== undefined) {
      category.technicalStatsPrompt = technicalStatsPrompt;
    }

    if (prompts !== undefined) {
      category.prompts = prompts;
    }

    if (icon !== undefined) {
      category.icon = icon;
    }
    if (image !== undefined) {
      category.image = image;
    }

    // ذخیره تغییرات (Trigger pre-save hooks)
    await category.save();

    revalidateContent(["navbar", "categories"]);

    return NextResponse.json({
      message: "دسته‌بندی با موفقیت به‌روزرسانی شد",
      category,
    });
  } catch (error) {
    // مدیریت خطای تداخل احتمالی نام ویژگی‌ها از سمت دیتابیس
    if (error.message.includes("نمی‌توانند همزمان")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ---------------------------------------------------------
// DELETE: حذف کتگوری
// ---------------------------------------------------------
export async function DELETE(req, { params }) {
  try {
    await connectToDB();
    const { categoryId } = await params;
    
    const category = await Category.findByIdAndDelete(categoryId);
    if (!category) {
      return NextResponse.json({ error: "دسته‌بندی پیدا نشد" }, { status: 404 });
    }

    revalidateContent(["navbar", "categories"]);

    return NextResponse.json({ message: "دسته‌بندی با موفقیت حذف شد" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}