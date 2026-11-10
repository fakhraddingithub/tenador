import requireAdminPermission from "@/lib/requireAdminPermission";
import { createProduct } from "@/lib/productCreationService";
import { handleApiError } from "@/lib/apiError";

export async function POST(req) {
  const { denied } = await requireAdminPermission("products.create");
  if (denied) return denied;
  try { return await createProduct(await req.json()); }
  catch (err) { return handleApiError(err, "خطا در ایجاد محصول"); }
}
