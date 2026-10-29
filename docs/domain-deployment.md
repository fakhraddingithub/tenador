# Production domain

The canonical production origin is `https://tenador.com`.

Set these variables in the hosting project's Production environment and redeploy:

```env
NEXT_PUBLIC_BASE_URL=https://tenador.com
NEXT_PUBLIC_SITE_URL=https://tenador.com
NEXT_PUBLIC_LOGO_URL=https://tenador.com/logo/logo.svg
```

The local `.env` does not update Vercel's environment settings. Keep local or
preview origins when intentionally testing authentication in those environments.

Before enabling the Cloudflare WWW redirect:

- Register `https://tenador.com/api/auth/google/callback` as an authorized redirect
  URI on the existing Google OAuth client. Both OAuth handlers derive this URI
  from `NEXT_PUBLIC_BASE_URL`.
- Check any payment-provider callback allowlists for the apex domain. The online
  payment handler derives its return links and webhook request from
  `NEXT_PUBLIC_BASE_URL`.
- Ensure Vercel serves `tenador.com` and has no redirect back to WWW.

Configure Cloudflare to redirect only host `www.tenador.com` to
`https://tenador.com` with the original path and query string. No duplicate
host redirect is configured in the application.

After deployment, verify:

- A WWW product/category URL redirects to the same path on the apex domain,
  preserving query parameters, without a redirect loop.
- The rendered homepage, product and guide article canonical URLs use the apex
  domain, as do `/sitemap.xml` and the sitemap declaration in `/robots.txt`.
- Google login completes successfully and payment callbacks work through the
  provider's test flow.
- CMS content, banners and custom category canonical URLs saved in the database
  do not retain internal WWW links. These are not changed by the source edits.

Do not globally replace external image hosts or third-party canonical URLs.
