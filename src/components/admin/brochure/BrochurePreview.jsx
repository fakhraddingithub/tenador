import Link from "next/link";
import { notFound } from "next/navigation";
import { FiEdit3, FiExternalLink } from "react-icons/fi";
import connectToDB from "base/configs/db";
import Brand from "base/models/Brand";
import Sport from "base/models/Sport";
import { getAdminContext } from "@/lib/adminContext";
import { canAccessAdminRoute } from "@/lib/permissions";
import { resolveArticleEntities } from "base/services/publicArticle.service";
import { isBrochureLive } from "@/lib/brandBrochure";
import { brochureOwner } from "@/lib/brochureOwners";
import PreviewCanvas from "@/components/admin/articles/PreviewCanvas";
import { PREVIEW_FRAMES } from "@/lib/previewFrames";

const MODELS = { brand: Brand, sport: Sport };

/**
 * پیش‌نمایشِ بروشور (برند، ورزش) — دقیقاً مثلِ پیش‌نمایشِ مقاله: کامپوننتِ سروری،
 * پشتِ همان مجوزِ ویرایشگر، و محتوای *ذخیره‌شده* (پیش‌نویس هم) با همان رندرکننده‌ای
 * که صفحه‌ی عمومی از آن استفاده می‌کند — پس آنچه می‌بینید همان چیزی است که پس
 * از انتشار روی آدرسِ صاحبش می‌نشیند.
 */
export default async function BrochurePreview({ owner, ownerId }) {
  const config = brochureOwner(owner);
  const { noun } = config;
  const ctx = await getAdminContext();
  if (!ctx?.can(config.permission)) notFound();

  await connectToDB();
  const doc = await MODELS[owner].findById(ownerId).select("+brochure name title slug").lean().catch(() => null);
  if (!doc) notFound();

  const blocks = doc.brochure?.blocks || [];
  const entities = blocks.length ? await resolveArticleEntities({ blocks }) : null;
  const live = isBrochureLive(doc.brochure);
  const canEdit = canAccessAdminRoute(ctx?.permissions || [], config.editorRoute);
  // lean → ObjectId/Date؛ باید ساده شود تا از مرزِ سرور→کلاینت رد شود.
  const plain = (value) => JSON.parse(JSON.stringify(value ?? null));

  return (
    <div>
      <div className="a-card sticky top-[132px] z-20 mb-4 flex flex-wrap items-center gap-3 p-3">
        <div>
          <strong className="block text-sm">پیش‌نمایش بروشور {doc.title || doc.name}</strong>
          <small className="text-gray-400">
            {live
              ? `این بروشور منتشر شده و هم‌اکنون روی صفحه‌ی ${noun} دیده می‌شود.`
              : "پیش‌نویس — روی سایت منتشر نشده است."}
          </small>
        </div>
        <div className="mr-auto flex flex-wrap items-center gap-2">
          {live && doc.slug ? (
            <a href={`/${doc.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[var(--admin-radius)] border px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]" style={{ borderColor: "var(--admin-border)" }}>
              <FiExternalLink aria-hidden="true" /> مشاهده در سایت
            </a>
          ) : null}
          {canEdit ? (
            <Link href={config.editor(ownerId)} className="inline-flex items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
              <FiEdit3 aria-hidden="true" /> ویرایش
            </Link>
          ) : null}
        </div>
      </div>

      {/* بومِ تمام‌عرض با همان ظرفِ صفحه‌ی بروشور (PREVIEW_FRAMES.brochure)، بدونِ
          کارت و قابِ اضافه — تا هر بلوک همان عرضی را بگیرد که روی سایت دارد.
          وضعیتِ انتشار در بدنه‌ی ذخیره تکرار می‌شود، وگرنه PUT آن را به پیش‌نویس
          برمی‌گرداند. */}
      {blocks.length ? (
        <PreviewCanvas
          blocks={plain(blocks)}
          entities={plain(entities)}
          canEdit={canEdit}
          endpoint={{ url: config.api(ownerId), method: "PUT", extra: { status: doc.brochure?.status || "draft" } }}
          frame={PREVIEW_FRAMES.brochure}
        />
      ) : (
        <p className="a-card p-12 text-center text-sm text-gray-400">هنوز بلوکی به این بروشور اضافه نشده است.</p>
      )}
    </div>
  );
}
