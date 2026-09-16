// All writes share one transaction: a failed cascade leaves the category intact.
export class CategoryDeletionError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function deleteCategoryWithProducts({
  Category, Product, Variant, PriceCache, SlugRegistery,
  categoryId, confirmationSlug,
}) {
  return Category.db.transaction(async (session) => {
    const category = await Category.findById(categoryId).session(session).lean();
    if (!category) throw new CategoryDeletionError("دسته‌بندی پیدا نشد", 404);
    if (!category.slug || typeof confirmationSlug !== "string" || confirmationSlug.trim() !== category.slug) {
      throw new CategoryDeletionError("برای تأیید حذف، اسلاگ دسته‌بندی را دقیق وارد کنید", 400);
    }
    const products = await Product.find({ category: category._id }).select("_id").session(session).lean();
    const productIds = products.map((product) => product._id);
    // Use the authoritative productId link, including variants absent from product.variants.
    await Variant.deleteMany({ productId: { $in: productIds } }, { session });
    await PriceCache.deleteMany({ productId: { $in: productIds } }, { session });
    const deleted = await Product.deleteMany({ _id: { $in: productIds } }, { session });
    await SlugRegistery.deleteMany({ type: "category", refId: category._id }, { session });
    // Children are separate categories; detach them rather than leaving a missing parent.
    await Category.updateMany({ parent: category._id }, { $set: { parent: null } }, { session });
    await Category.deleteOne({ _id: category._id }, { session });
    return { category, deletedProducts: deleted.deletedCount };
  });
}
