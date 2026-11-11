// Keep all writes in one transaction, including validation/save middleware.
// Sequential writes are required on a MongoDB transaction session.
export async function createProductWithVariants({ Product, Variant, productData, variants, onCommitted }) {
  return Product.db.transaction(async (session) => {
    const product = new Product(productData);
    const documents = variants.map((variant, index) => new Variant({
      ...variant,
      productId: product._id,
      sku: `${product.sku}-V${index + 1}`,
    }));
    product.variants = documents.map((variant) => variant._id);
    product.$session(session);
    await product.validate();
    for (const variant of documents) {
      variant.$session(session);
      await variant.validate();
    }
    await product.save();
    for (const variant of documents) await variant.save();
    if (onCommitted) await onCommitted(session, product);
    return product;
  });
}
