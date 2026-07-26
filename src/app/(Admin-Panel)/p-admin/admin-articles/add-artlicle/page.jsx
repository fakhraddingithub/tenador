import { redirect } from "next/navigation";

export default function LegacyAddArticlePage() {
  redirect("/p-admin/admin-articles/new");
}
