const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://tenador.com").replace(/\/+$/, "");

export function generateAthleteMetadata(athlete) {
  const title = athlete.title;

  const description =
    (athlete.bio && athlete.bio.slice(0, 160)) ||
    `پروفایل ${athlete.title}${athlete.sport?.name ? `، ورزشکار رشته‌ی ${athlete.sport.name}` : ""} در تنادور`;

  const rawImage = athlete.photo || null;
  const imageUrl = rawImage
    ? rawImage.startsWith("http")
      ? rawImage
      : `${SITE_URL}${rawImage}`
    : null;

  const canonicalUrl = `${SITE_URL}/athletes/${athlete.slug}`;

  return {
    title,
    description,

    metadataBase: new URL(SITE_URL),

    alternates: {
      canonical: canonicalUrl,
    },

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
