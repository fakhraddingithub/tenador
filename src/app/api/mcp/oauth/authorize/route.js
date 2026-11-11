import "base/models/registerModels";
import McpGrant from "base/models/McpGrant";
import { getAdminContext } from "@/lib/adminContext";
import { config, validateAuthorization, secret, digest, noStore, escapeHtml } from "@/lib/mcp/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const c = config();
    const data = validateAuthorization(new URL(req.url).searchParams, c);
    const ctx = await getAdminContext();
    if (!ctx) {
      // Keep the already-validated OAuth request, including state and PKCE,
      // through local/Google login. Never redirect directly to the client here:
      // the authenticated admin must still see and approve the consent screen.
      const returnTo = `/api/mcp/oauth/authorize?${new URLSearchParams(data)}`;
      const loginUrl = `/login-register?${new URLSearchParams({ callbackUrl: returnTo })}`;
      return new Response(`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>ورود برای اتصال تنادور</title><p>با حساب ادمین وارد شوید؛ سپس برای تأیید اجازهٔ اتصال به همین درخواست برمی‌گردید.</p><a href="${escapeHtml(loginUrl)}">ورود</a></html>`, { status: 401, headers: { ...noStore, "Content-Type": "text/html; charset=utf-8", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'", "X-Frame-Options": "DENY" } });
    }
    if (!ctx.can("ai.productDraft")) return new Response("Forbidden", { status: 403 });
    // Chromium also checks form-action on the redirect after the POST.
    // This origin comes only from the exact, validated callback allowlist.
    const callbackOrigin = new URL(data.redirect_uri).origin;
    const consent = secret();
    await McpGrant.create({ key: digest(consent), kind: "consent", userId: ctx.userId, data, expiresAt: new Date(Date.now() + 300000) });
    // no-referrer makes native form POSTs send Origin: null, failing the CSRF gate.
    // strict-origin preserves Origin without leaking OAuth query parameters.
    return new Response(`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>اتصال تنادور</title><body><h1>اتصال ChatGPT به محصولات تنادور</h1><p>این اتصال اجازهٔ خواندن قوانین و محصولات، دریافت اطلاعات و عکس از سایت مرجع، ساخت محصول غیرفعال و بازنویسی محصول را در محدودهٔ دسترسی حساب شما دارد.</p><p>حساب: ${escapeHtml(ctx.user.name || ctx.userId)}</p><p>مقصد اتصال: <bdi>${escapeHtml(new URL(data.redirect_uri).origin)}</bdi></p><form method="post"><input type="hidden" name="consent" value="${consent}"><button name="decision" value="allow">اجازهٔ اتصال</button> <button name="decision" value="deny">انصراف</button></form></body></html>`, { headers: { ...noStore, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": `default-src 'none'; form-action 'self' ${callbackOrigin}; frame-ancestors 'none'; base-uri 'none'`, "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin" } });
  } catch { return Response.json({ error: "invalid_request" }, { status: 400, headers: noStore }); }
}
export async function POST(req) {
  try {
    const c = config();
    if (req.headers.get("origin") !== c.origin) return new Response("Forbidden", { status: 403 });
    const ctx = await getAdminContext();
    if (!ctx?.can("ai.productDraft")) return new Response("Forbidden", { status: 403 });
    const form = await req.formData();
    const grant = await McpGrant.findOneAndDelete({ key: digest(String(form.get("consent") || "")), kind: "consent", userId: ctx.userId, expiresAt: { $gt: new Date() } });
    if (!grant) return Response.json({ error: "invalid_request" }, { status: 400 });
    validateAuthorization(new URLSearchParams(grant.data), c);
    const redirect = new URL(grant.data.redirect_uri);
    if (grant.data.state) redirect.searchParams.set("state", grant.data.state);
    if (form.get("decision") === "allow") {
      const code = secret();
      await McpGrant.create({ key: digest(code), kind: "code", userId: ctx.userId, data: grant.data, expiresAt: new Date(Date.now() + 60000) });
      redirect.searchParams.set("code", code);
    } else redirect.searchParams.set("error", "access_denied");
    return Response.redirect(redirect, 303);
  } catch { return Response.json({ error: "invalid_request" }, { status: 400, headers: noStore }); }
}
