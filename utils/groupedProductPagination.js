export const BRAND_PRODUCTS_PER_BATCH = 20;
export const BRAND_SECTIONS_PER_BATCH = 6;

const nonNegativeInt = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
};

/**
 * Builds a deterministic cursor plan with both a section offset and an offset
 * inside that section. Product payload, rather than section size, is the hard
 * budget so a 90-product "other" section cannot create a 90-card response.
 */
export function planGroupedProductPage(
  entries,
  {
    sectionOffset = 0,
    productOffset = 0,
    sectionLimit = BRAND_SECTIONS_PER_BATCH,
    productLimit = BRAND_PRODUCTS_PER_BATCH,
  } = {},
) {
  const list = Array.isArray(entries) ? entries : [];
  let cursor = Math.min(nonNegativeInt(sectionOffset), list.length);
  let offsetInSection = nonNegativeInt(productOffset);
  const normalizedProductLimit = nonNegativeInt(
    productLimit,
    BRAND_PRODUCTS_PER_BATCH,
  );
  const normalizedSectionLimit = nonNegativeInt(
    sectionLimit,
    BRAND_SECTIONS_PER_BATCH,
  );
  let remainingProducts =
    normalizedProductLimit > 0
      ? normalizedProductLimit
      : BRAND_PRODUCTS_PER_BATCH;
  const maxSections =
    normalizedSectionLimit > 0
      ? normalizedSectionLimit
      : BRAND_SECTIONS_PER_BATCH;
  const plans = [];

  while (
    cursor < list.length &&
    plans.length < maxSections &&
    remainingProducts > 0
  ) {
    const entry = list[cursor];
    const productCount = nonNegativeInt(entry?.productCount);

    if (offsetInSection >= productCount) {
      cursor += 1;
      offsetInSection = 0;
      continue;
    }

    const take = Math.min(productCount - offsetInSection, remainingProducts);
    plans.push({
      entry,
      sectionIndex: cursor,
      skip: offsetInSection,
      take,
    });
    remainingProducts -= take;

    if (offsetInSection + take < productCount) {
      offsetInSection += take;
      break;
    }

    cursor += 1;
    offsetInSection = 0;
  }

  return {
    plans,
    nextOffset: cursor,
    nextProductOffset: offsetInSection,
    hasMore: cursor < list.length,
  };
}

const productIdentity = (product) =>
  product?._id == null
    ? product?.id == null
      ? product?.slug || null
      : String(product.id)
    : String(product._id);

/**
 * Appends product chunks to an existing section while preserving the original
 * section order and preventing duplicate cards across every loaded section.
 */
export function mergeGroupedSections(currentSections, incomingSections) {
  const merged = (Array.isArray(currentSections) ? currentSections : []).map(
    (section) => ({
      ...section,
      products: [...(section?.products || [])],
    }),
  );
  const sectionPositions = new Map(
    merged.map((section, index) => [String(section.key), index]),
  );
  const seenProducts = new Set();

  for (const section of merged) {
    for (const product of section.products) {
      const identity = productIdentity(product);
      if (identity) seenProducts.add(identity);
    }
  }

  for (const incoming of Array.isArray(incomingSections) ? incomingSections : []) {
    const key = String(incoming.key);
    const position = sectionPositions.get(key);
    const newProducts = [];

    for (const product of incoming.products || []) {
      const identity = productIdentity(product);
      if (identity && seenProducts.has(identity)) continue;
      if (identity) seenProducts.add(identity);
      newProducts.push(product);
    }

    if (position == null) {
      sectionPositions.set(key, merged.length);
      merged.push({ ...incoming, products: newProducts });
    } else if (newProducts.length > 0) {
      merged[position] = {
        ...merged[position],
        ...incoming,
        products: [...merged[position].products, ...newProducts],
      };
    }
  }

  return merged;
}
