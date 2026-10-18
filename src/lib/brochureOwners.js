/**
 * صاحبانِ بروشور — هر جایی که یک بروشورِ تمام‌صفحه می‌تواند جای محتوای صفحه را
 * بگیرد. ویرایشگر، کارت، پیش‌نمایش و روتِ API همه از همین جدول می‌خوانند، پس
 * بروشورِ ورزش *همان* سیستمِ بروشورِ برند است، نه نسخه‌ی دومی از آن.
 *
 * ماژولِ ساده و بدونِ import: هم سمتِ سرور (روت، پیش‌نمایش) هم کلاینت (ویرایشگر،
 * کارت) آن را می‌خوانند.
 */
export const BROCHURE_OWNERS = {
  brand: {
    noun: "برند",
    permission: "brands.edit",
    api: (id) => `/api/brands/${id}/brochure`,
    editor: (id) => `/p-admin/admin-brands/${id}/brochure`,
    preview: (id) => `/p-admin/admin-brands/${id}/brochure/preview`,
    back: (id) => `/p-admin/admin-brands/edit/${id}`,
    // الگوی manifest برای canAccessAdminRoute (همان کلیدِ ADMIN_ROUTE_PERMISSIONS).
    editorRoute: "/p-admin/admin-brands/[brandId]/brochure",
  },
  sport: {
    noun: "ورزش",
    permission: "sports.edit",
    api: (id) => `/api/sports/${id}/brochure`,
    editor: (id) => `/p-admin/admin-sports/${id}/brochure`,
    preview: (id) => `/p-admin/admin-sports/${id}/brochure/preview`,
    back: (id) => `/p-admin/admin-sports/edit/${id}`,
    editorRoute: "/p-admin/admin-sports/[sportId]/brochure",
  },
};

export const brochureOwner = (owner) => {
  const config = BROCHURE_OWNERS[owner];
  if (!config) throw new Error(`Unknown brochure owner: ${owner}`);
  return config;
};
