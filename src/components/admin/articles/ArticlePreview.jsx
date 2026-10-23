import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowRight, FiEdit3 } from "react-icons/fi";
import { getAdminContext } from "@/lib/adminContext";
import { canAccessAdminRoute } from "@/lib/permissions";
import { getArticleForAdmin } from "base/services/article.service";
import { resolveArticleEntities } from "base/services/publicArticle.service";
import PreviewCanvas from "@/components/admin/articles/PreviewCanvas";
import { PREVIEW_FRAMES } from "@/lib/previewFrames";

export default async function ArticlePreview({ articleId }) {
  // فاز ۷: گیتِ legacy (requireAdmin → User.role==="admin") برداشته شد.
  // تنها منبعِ مجوز، عضویتِ فعال است؛ و همین زمینه هم برای گیتِ لینکِ ویرایش
  // استفاده می‌شود. این کامپوننت سروری است، پس useAdminPermissions ندارد.
  const ctx = await getAdminContext();
  if (!ctx?.can("articles.view")) notFound();
  const canRoute = (route) => canAccessAdminRoute(ctx?.permissions || [], route);
  const canEdit = Boolean(ctx?.can("articles.edit"));
  // داده‌ی lean حاوی ObjectId/Date است و مستقیم از مرزِ سرور→کلاینت رد نمی‌شود.
  const plain = (value) => JSON.parse(JSON.stringify(value ?? null));
  const article = await getArticleForAdmin(articleId);
  if (!article) notFound();
  const entities = await resolveArticleEntities(article);
  return (
    <div>
      <div className="a-card sticky top-[132px] z-20 mb-4 flex items-center gap-3 p-3">
        <div><strong className="block text-sm">پیش‌نمایش مقاله</strong><small className="text-gray-400">این صفحه برای مشتریان منتشر نشده است.</small></div>
        {canRoute(`/p-admin/admin-articles/${articleId}`) ? <Link href={`/p-admin/admin-articles/${articleId}`} className="mr-auto inline-flex items-center gap-2 rounded-[var(--admin-radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><FiEdit3 aria-hidden="true" /> ویرایش</Link> : null}
      </div>
      {/* بدونِ کارت و قاب: سرِ مقاله نواری تمام‌عرض است (مثلِ سایت) و بوم زیرش همان
          ستونِ ۸۲۰ پیکسلیِ صفحه‌ی عمومی را دارد (PREVIEW_FRAMES.article)، تا هر بلوک
          دقیقاً به اندازه‌ی سایت دیده شود. -mx همان padding ـِ main پنل را خنثی می‌کند. */}
      <article className="site-colors">
        <header className="-mx-4 border-b border-black/5 bg-white px-4 py-8 text-center sm:-mx-6 md:py-12">
          <div className="mx-auto max-w-5xl">
            {article.category?.name ? <span className="inline-flex rounded-full bg-[color-mix(in_srgb,var(--color-primary)_10%,white)] px-4 py-2 text-xs font-bold text-[var(--color-primary)]">{article.category.name}</span> : null}
            <h1 className="mt-5 text-3xl font-black leading-[1.55] text-gray-900 md:text-5xl">{article.title}</h1>
            {article.excerpt ? <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-gray-600 md:text-lg">{article.excerpt}</p> : null}
          </div>
          {article.cover?.url ? <div className="relative mx-auto mt-10 aspect-[16/8] max-w-6xl overflow-hidden rounded-[var(--radius)] bg-gray-100"><Image src={article.cover.url} alt={article.cover.alt || article.title} fill priority sizes="(max-width: 1280px) 100vw, 1152px" className="object-cover" /></div> : null}
        </header>
        {/* بوم همان بلوک‌های *ذخیره‌شده* را می‌گیرد و خودش رندر می‌کند، پس ویرایش
            و جابه‌جایی بی‌درنگ دیده می‌شود. مجوزِ ویرایش جداست: ادمینی که فقط
            articles.view دارد، همان پیش‌نمایشِ خواندنیِ قبلی را می‌بیند. */}
        <div data-article-body>
          <PreviewCanvas
            blocks={plain(article.blocks || [])}
            entities={plain(entities)}
            canEdit={canEdit}
            endpoint={{ url: `/api/admin/articles/${articleId}`, method: "PATCH" }}
            frame={PREVIEW_FRAMES.article}
          />
        </div>
      </article>
    </div>
  );
}
