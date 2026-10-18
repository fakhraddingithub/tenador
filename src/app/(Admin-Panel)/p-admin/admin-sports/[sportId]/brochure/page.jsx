import BrochureEditor from "@/components/admin/brochure/BrochureEditor";

export const metadata = { title: "بروشور ورزش | پنل تنادور" };

export default async function SportBrochurePage({ params }) {
  const { sportId } = await params;
  return <BrochureEditor owner="sport" ownerId={sportId} />;
}
