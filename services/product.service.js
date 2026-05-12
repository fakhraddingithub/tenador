import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import SlugRegistery from "base/models/SlugRegistery";
import mongoose from "mongoose";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import Athlete from "base/models/Athlete";
import Category from "base/models/Category";
import Variant from "base/models/Variant";

const modelsMap = {
  Sport,
  Brand,
  Athlete,
  Category,
};

export async function getProducts() {
  try {
    await connectToDB();
    const products = await Product.find({})
      .populate("brand")
      .populate("sport")
      .populate("athlete")
      .populate("category")
      .populate("variants")
      .lean();

    return JSON.parse(JSON.stringify(products));
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      {
        error: "خطا در دریافت محصولات",
        detail: error.message,
        products: [],
      },
      { status: 500 },
    );
  }
}

export async function getProductBySlug(slug) {

  const decodedSlug = decodeURIComponent(slug);
  
  try {
    await connectToDB();

    const product = await Product.findOne({ slug: decodedSlug })
      .populate("brand")
      .populate("serie")
      .populate("sport")
      .populate("athlete")
      .populate("category")
      .populate("variants")
      .lean();

    if (!product) {
      return { error: "محصول پیدا نشد", status: 404 };
    }

    const mergedAttributes = product.category.attributes.map((attr) => ({
      ...attr,
      value: product.attributes?.[attr.name] ?? null,
    }));

    return JSON.parse(
      JSON.stringify({
        ...product,
        attributes: mergedAttributes,
      }),
    );
  } catch (err) {
    return { error: err.message, status: 500 };
  }
}

export async function getPageDataBySlug(slug) {
  await connectToDB();

  // ۱. پیدا کردن اسلاگ در رجیستری
  const slugData = await SlugRegistery.findOne({
    slug: slug.toLowerCase(),
  }).lean();

  if (!slugData) {
    return null;
  }

  // ۲. پیدا کردن اطلاعات خودِ موجودیت (مثلاً اطلاعات ورزش یا برند)
  // از آنجایی که نام مدل را در دیتابیس ذخیره کردیم، داینامیک عمل می‌کنیم
  const EntityModel = modelsMap[slugData.model];

  if (!EntityModel) {
    console.error(`مدل ${slugData.model} در نقشه مدل‌ها تعریف نشده است.`);
    return null;
  }

  const entityInfo = await EntityModel.findOne({ slug }).lean();

  // ۳. پیدا کردن محصولات مرتبط
  // از filterField و filterValue که در رجیستری ذخیره شده استفاده می‌کنیم
  const productQuery = {
    [slugData.filterField]: entityInfo._id,
  };

  const products = await Product.find(productQuery)
    .populate("brand")
    .populate("sport")
    .populate("athlete")
    .populate("category")
    .populate("variants")
    .sort({ createdAt: -1 }) // جدیدترین‌ها اول
    .lean();

  return {
    type: slugData.type, // مثلا: 'sport'
    info: entityInfo, // اطلاعات کامل ورزش (نام، عکس، توضیحات)
    products: products, // لیست محصولات این ورزش
    label: slugData.label, // عنوان سئو شده
    slugData: slugData, // کل متادیتای اسلاگ در صورت نیاز
  };
}
