const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

function label(entity) {
  return entity?.title || entity?.name || "";
}

export function buildTaxonomyMetadata(filters) {
  const sport = label(filters?.sport);
  const category = label(filters?.category);
  const brand = label(filters?.brand);
  const serie = label(filters?.serie);
  const limitedEdition = label(filters?.limitedEdition);

  if (limitedEdition && brand) {
    return {
      title: `خرید محصولات ${brand} ${limitedEdition}`,
      description:
        filters.limitedEdition.description ||
        `مشاهده و خرید محصولات کالکشن ${limitedEdition} از برند ${brand} با بررسی قیمت، مشخصات و موجودی در تنادور.`,
    };
  }

  if (serie && brand && sport) {
    return {
      title: `خرید ${sport} ${brand} سری ${serie}`,
      description:
        filters.serie.description ||
        `مشاهده و خرید محصولات سری ${serie} برند ${brand} برای ${sport} با بررسی قیمت، مشخصات و موجودی در تنادور.`,
    };
  }

  if (category && brand && sport) {
    return {
      title: `خرید ${category} ${sport} ${brand}`,
      description:
        `مشاهده و خرید محصولات ${category} ${sport} از برند ${brand} با بررسی قیمت، مشخصات و موجودی در تنادور.`,
    };
  }

  if (brand && sport) {
    return {
      title: `خرید محصولات ${brand} برای ${sport}`,
      description:
        filters.brand.description ||
        `مشاهده و خرید محصولات برند ${brand} برای ${sport} با بررسی قیمت، مشخصات و موجودی در تنادور.`,
    };
  }

  if (category && sport) {
    return {
      title: `خرید ${category} ${sport}`,
      description:
        filters.category.description ||
        `مشاهده و خرید ${category} ${sport} از برندهای معتبر با بررسی قیمت، مشخصات و موجودی در تنادور.`,
    };
  }

  if (brand) {
    return {
      title: `خرید محصولات برند ${brand}`,
      description:
        filters.brand.description ||
        `مشاهده و خرید محصولات برند ${brand} با بررسی قیمت، مشخصات و موجودی در تنادور.`,
    };
  }

  if (sport) {
    return {
      title: `خرید تجهیزات و لوازم ${sport}`,
      description:
        filters.sport.description ||
        `مشاهده و خرید تجهیزات تخصصی ${sport} از برندهای معتبر با بررسی قیمت، مشخصات و موجودی در تنادور.`,
    };
  }

  const active =
    filters?.limitedEdition ||
    filters?.serie ||
    filters?.brand ||
    filters?.category ||
    filters?.sport;

  return {
    title: `خرید تجهیزات ${label(active)}`,
    description:
      active?.description ||
      `مشاهده و خرید تجهیزات ${label(active)} با بررسی قیمت، مشخصات و موجودی در تنادور.`,
  };
}

export function buildTaxonomyBreadcrumbs(filters) {
  const items = [{ name: "خانه", href: "/" }];
  const sport = filters?.sport;
  const category = filters?.category;
  const brand = filters?.brand;
  const serie = filters?.serie;
  const limitedEdition = filters?.limitedEdition;

  if (sport?.slug) {
    items.push({ name: label(sport), href: `/${sport.slug}` });
  }

  if (category?.slug && sport?.slug) {
    items.push({
      name: label(category),
      href: `/${sport.slug}/${category.slug}`,
    });
  }

  if (brand?.slug) {
    const href = sport?.slug
      ? category?.slug
        ? `/${sport.slug}/${category.slug}/${brand.slug}`
        : `/${sport.slug}/${brand.slug}`
      : `/${brand.slug}`;
    items.push({ name: label(brand), href });
  }

  if (serie?.slug && sport?.slug && brand?.slug) {
    items.push({
      name: label(serie),
      href: `/${sport.slug}/${brand.slug}/${serie.slug}`,
    });
  }

  if (limitedEdition?.slug && brand?.slug) {
    items.push({
      name: label(limitedEdition),
      href: `/${brand.slug}/${limitedEdition.slug}`,
    });
  }

  return items.map((item) => ({
    ...item,
    url: `${SITE_URL}${item.href === "/" ? "" : item.href}`,
  }));
}
