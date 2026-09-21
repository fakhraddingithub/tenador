import Link from "next/link";
import { notFound } from "next/navigation";
import { FiEdit3, FiExternalLink } from "react-icons/fi";
import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import { getAdminContext } from "@/lib/adminContext";
import { canAccessAdminRoute } from "@/lib/permissions";
import { resolveArticleEntities } from "base/services/publicArticle.service";
import { isBrochureLive } from "@/lib/brandBrochure";
import PreviewCanvas from "@/components/admin/articles/PreviewCanvas";

/**
 * پیش‌نمایشِ بروشور — دقیقاً مثلِ پیش‌نمایشِ مقاله: کامپوننتِ سروری، پشتِ همان
 * مجوزِ ویرایشگر، و محتوای *ذخیره‌شده* (پیش‌نویس هم) با همان BrandBrochure که
 * صفحه‌ی عمومیِ برند از آن استفاده می‌کند — پس آنچه می‌بینید همان چیزی است که
 * پس از انتشار روی آدرسِ برند می‌نشیند.
 */
export default async function BrandBrochurePreview({ brandId }) {
  const ctx = await getAdminContext();
  if (!ctx?.can("brands.edit")) notFound();

  await connectToDB();
  const brand = await Brand.findById(brandId).select("+brochure name title slug").lean();
  if (!brand) notFound();

  const blocks = brand.brochure?.blocks || [];
  const entities = blocks.length ? await resolveArticleEntities({ blocks }) : null;
  const live = isBrochureLive(brand.brochure);
  const canEdit = canAccessAdminRoute(ctx?.permissions || [], "/p-admin/admin-brands/[brandId]/brochure");
  // lean → ObjectId/Date؛ باید ساده شود تا از مرزِ سرور→کلاینت رد شود.
  const plain = (value) => JSON.parse(JSON.stringify(value ?? null));

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="a-card sticky top-[132px] z-20 mb-4 flex flex-wrap items-center gap-3 p-3">
        <div>
          <strong className="block text-sm">پیش‌نمایش بروشور {brand.title || brand.name}</strong>
          <small className="text-gray-400">
            {live
              ? "این بروشور منتشر شده و هم‌اکنون روی صفحه‌ی برند دیده می‌شود."
              : "پیش‌نویس — روی سایت منتشر نشده است."}
          </small>
        </div>
        <div className="mr-auto flex flex-wrap items-center gap-2">
          {live && brand.slug ? (
            <a href={`/${brand.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[var(--admin-radius)] border px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]" style={{ borderColor: "var(--admin-border)" }}>
              <FiExternalLink aria-hidden="true" /> مشاهده در سایت
            </a>
          ) : null}
          {canEdit ? (
            <Link href={`/p-admin/admin-brands/${brandId}/brochure`} className="inline-flex items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
              <FiEdit3 aria-hidden="true" /> ویرایش
            </Link>
          ) : null}
        </div>
      </div>

      {/* همان ظرفِ BrandBrochure (تا پیش‌نمایش دقیقاً شکلِ صفحه‌ی برند باشد)
          ولی محتوایش از بوم می‌آید تا قابلِ ویرایش بماند. وضعیتِ انتشار در
          بدنه‌ی ذخیره تکرار می‌شود، وگرنه PUT آن را به پیش‌نویس برمی‌گرداند. */}
      {blocks.length ? (
        <div className="a-card">
          <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-8">
            <PreviewCanvas
              blocks={plain(blocks)}
              entities={plain(entities)}
              canEdit={canEdit}
              endpoint={{ url: `/api/brands/${brandId}/brochure`, method: "PUT", extra: { status: brand.brochure?.status || "draft" } }}
            />
          </div>
        </div>
      ) : (
        <p className="a-card p-12 text-center text-sm text-gray-400">هنوز بلوکی به این بروشور اضافه نشده است.</p>
      )}
    </div>
  );
}
