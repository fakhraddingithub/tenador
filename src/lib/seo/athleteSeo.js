const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

const absolute = (url) =>
  !url ? null : url.startsWith("http") ? url : `${SITE_URL}${url}`;

const sportLabel = (athlete) =>
  athlete.sport?.title || athlete.sport?.name || "";

export const athleteCanonical = (athlete) =>
  `${SITE_URL}/athletes/${athlete.slug}`;

/**
 * توضیحِ متا: اولویت با بیوگرافی؛ در نبودش از روی داده‌های موجود ساخته می‌شود
 * تا هیچ صفحه‌ای بدون description منتشر نشود.
 */
function buildDescription(athlete) {
  if (athlete.bio) {
    const clean = athlete.bio.replace(/\s+/g, " ").trim();
    return clean.length > 160 ? `${clean.slice(0, 157).trimEnd()}…` : clean;
  }

  const sport = sportLabel(athlete);
  const parts = [
    `پروفایل ${athlete.title}`,
    sport && `ورزشکار رشته‌ی ${sport}`,
    athlete.nationality && `از ${athlete.nationality}`,
  ].filter(Boolean);

  const honors = (athlete.honors || []).filter((honor) => honor?.title).length;

  return `${parts.join("، ")}${honors > 0 ? ` — ${honors} عنوان و افتخار ورزشی` : ""}. مشاهده‌ی مشخصات، افتخارات و محصولات مرتبط در تنادور.`;
}

export function generateAthleteMetadata(athlete) {
  const sport = sportLabel(athlete);
  const title = sport ? `${athlete.title} — ورزشکار ${sport}` : athlete.title;
  const description = buildDescription(athlete);
  const canonicalUrl = athleteCanonical(athlete);

  // عکسِ خودِ ورزشکار مرجّح است؛ در نبودش کاورِ رشته‌ی ورزشی به‌عنوان تصویرِ اشتراک.
  const imageUrl = absolute(athlete.photo) || absolute(athlete.sport?.image);

  return {
    title,
    description,

    metadataBase: new URL(SITE_URL),

    alternates: {
      canonical: canonicalUrl,
    },

    keywords: [athlete.title, athlete.name, sport, athlete.nationality]
      .filter(Boolean)
      .concat("تنادور"),

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "تنادور",
      locale: "fa_IR",
      type: "profile",
      ...(athlete.name && { profile: { username: athlete.name } }),
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: athlete.title }],
      }),
    },

    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

/**
 * ساختاردادهٔ Person برای ورزشکار — فقط فیلدهای موجود منتشر می‌شوند تا خروجیِ
 * schema.org معتبر و بدونِ مقدارِ خالی بماند.
 */
export function generateAthleteSchema(athlete) {
  const canonicalUrl = athleteCanonical(athlete);
  const sport = sportLabel(athlete);
  const image = absolute(athlete.photo);

  const awards = (athlete.honors || [])
    .filter((honor) => honor?.title)
    .map((honor) =>
      Number(honor.quantity) > 1
        ? `${honor.title} (${honor.quantity})`
        : honor.title,
    );

  const sponsors = (athlete.sponsors || [])
    .filter((sponsor) => sponsor?.name || sponsor?.title)
    .map((sponsor) => ({
      "@type": "Organization",
      name: sponsor.title || sponsor.name,
      ...(sponsor.slug && { url: `${SITE_URL}/${sponsor.slug}` }),
      ...(absolute(sponsor.logo) && { logo: absolute(sponsor.logo) }),
    }));

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${canonicalUrl}#person`,
    name: athlete.title,
    ...(athlete.name && { alternateName: athlete.name }),
    url: canonicalUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    ...(image && { image }),
    ...(athlete.bio && { description: athlete.bio }),
    jobTitle: "ورزشکار",
    ...(athlete.gender && {
      gender: athlete.gender === "female" ? "Female" : "Male",
    }),
    ...(athlete.nationality && {
      nationality: { "@type": "Country", name: athlete.nationality },
    }),
    ...(athlete.birthDate && {
      birthDate: new Date(athlete.birthDate).toISOString().slice(0, 10),
    }),
    ...(athlete.height != null && {
      height: { "@type": "QuantitativeValue", value: athlete.height, unitCode: "CMT" },
    }),
    ...(athlete.weight != null && {
      weight: { "@type": "QuantitativeValue", value: athlete.weight, unitCode: "KGM" },
    }),
    ...(sport && { knowsAbout: sport }),
    ...(awards.length > 0 && { award: awards }),
    ...(sponsors.length > 0 && { sponsor: sponsors }),
  };
}

/**
 * نان‌خرده‌ها: خانه ← رشته‌ی ورزشی (در صورتِ وجودِ اسلاگ) ← ورزشکار.
 * از همان ساختارِ generateBreadcrumbSchema محصول پیروی می‌کند.
 */
export function generateAthleteBreadcrumbSchema(athlete) {
  const itemListElement = [
    { "@type": "ListItem", position: 1, name: "خانه", item: SITE_URL },
  ];

  let position = 2;

  if (athlete.sport?.slug) {
    itemListElement.push({
      "@type": "ListItem",
      position: position++,
      name: sportLabel(athlete),
      item: `${SITE_URL}/${athlete.sport.slug}`,
    });
  }

  itemListElement.push({
    "@type": "ListItem",
    position: position++,
    name: athlete.title,
    item: athleteCanonical(athlete),
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}
