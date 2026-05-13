import connectToDB from "base/configs/db";
import Product from "base/models/Product";
import Sport from "base/models/Sport";

/**
 * سری‌هایی که برای این ورزش حداقل یک محصول دارند
 * به همراه تصویر representative از اولین محصول
 */
export async function getSeriesBySport(sportSlug) {
  await connectToDB();

  const sport = await Sport.findOne({ slug: sportSlug }).select("_id").lean();
  if (!sport) return [];

  const results = await Product.aggregate([
    // 1. محصولات این ورزش که سری دارند
    {
      $match: {
        sport: sport._id,
        serie: { $exists: true, $ne: null },
      },
    },
    // 2. join سری
    {
      $lookup: {
        from: "series",
        localField: "serie",
        foreignField: "_id",
        as: "serieDoc",
      },
    },
    { $unwind: "$serieDoc" },
    
    // 3. فیلتر کردن بر اساس سطح (Level)
    // اگر منظور سری‌های بدون والد است، عدد را به 0 تغییر دهید
    {
      $match: {
        "serieDoc.level": 1, 
      },
    },

    // 4. join برند سری
    {
      $lookup: {
        from: "brands",
        localField: "serieDoc.brand",
        foreignField: "_id",
        as: "brandDoc",
      },
    },
    { $unwind: { path: "$brandDoc", preserveNullAndEmptyArrays: true } },

    // 5. گروه‌بندی
    {
      $group: {
        _id: "$serieDoc._id",
        name: { $first: "$serieDoc.name" },
        title: { $first: "$serieDoc.title" },
        slug: { $first: "$serieDoc.slug" },
        colors: { $first: "$serieDoc.colors" },
        logo: { $first: "$serieDoc.logo" },
        icon: { $first: "$serieDoc.icon" },
        // اصلاح این بخش: استفاده از تصویر خودِ سری به جای محصول
        coverImage: { $first: "$serieDoc.image" }, 
        brandTitle: { $first: "$brandDoc.title" },
        brandLogo: { $first: "$brandDoc.logo" },
        brandSlug: { $first: "$brandDoc.slug" },
        productCount: { $sum: 1 },
      },
    },
    { $sort: { productCount: -1 } },
  ]);

  return results.map((s) => ({
    _id: s._id.toString(),
    name: s.name,
    title: s.title,
    slug: s.slug,
    colors: s.colors || {},
    logo: s.logo || "",
    coverImage: s.coverImage || "", // تصویر از فیلد image سری می‌آید
    productCount: s.productCount,
    brand: {
      title: s.brandTitle || "",
      logo: s.brandLogo || "",
      slug: s.brandSlug || "",
    },
  }));
}