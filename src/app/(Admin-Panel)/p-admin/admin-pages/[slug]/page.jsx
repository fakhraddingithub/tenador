import { notFound } from "next/navigation";
import PageEditor from "@/components/admin/pages/PageEditor";
import { PAGE_SLUGS } from "@/lib/pageDefaults";

export const metadata = {
  title: "ویرایش صفحه | پنل تنادور",
};

export default async function AdminPageEditorPage({ params }) {
  const { slug } = await params;
  if (!PAGE_SLUGS.includes(slug)) notFound();
  return <PageEditor slug={slug} />;
}
