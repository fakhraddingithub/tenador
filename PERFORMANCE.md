# Tenador — Site Speed Optimization Plan & Implementation

> Goal: instant, SPA-like navigation. Heavy data work on the server, cached;
> links prefetched; pages cached after first load; clearly defined SSR/CSR strategy.

---

## 1. Root causes of slow page loads (diagnosis)

| # | Problem | Impact |
|---|---------|--------|
| 1 | **Navbar fetched `/api/navbar` client-side** in a `useEffect` on **every** page | Network round-trip after every render; mega-menu empty until it resolves |
| 2 | **`[sportSlug]/[...slug]` page did an HTTP `fetch` to its own `/api/query`** with `cache: "no-store"` — and `generateMetadata` repeated the same request | 2× full HTTP round-trips (TCP + serialize + DB) per page view |
| 3 | **`getProducts` / `getProductBySlug` / `getPageDataBySlug` / `getSeriesBySport` were uncached** | MongoDB hit (with multiple `populate`s) on **every** render |
| 4 | **`ShowcaseAthletes` fetched client-side** in `useEffect` with a loading skeleton | Home page shows skeleton flash + extra request every visit |
| 5 | **`BannerSection` did an HTTP self-fetch** to `/api/banners` | Network round-trip during SSR instead of a direct DB read |
| 6 | **Navbar mega-menu used `window.location.href`** | Full page reload (kills SPA) on every category/brand click |
| 7 | **Product page queried the DB twice** — once in `generateMetadata`, once in the page | Double work for the same product |
| 8 | **Product price flashed `۰ تومان`** until the client price API resolved | Looked broken / slow even when fast |

---

## 2. What was implemented

### 2.1 Server-side, cached data layer (`unstable_cache`)
All hot read paths are now wrapped in `unstable_cache` with tags, so the DB is hit
at most once per revalidate window instead of once per request:

| Function | File | Revalidate | Tags |
|----------|------|-----------|------|
| `getProducts` | `services/product.service.js` | 60s | `products` |
| `getProductBySlug` | `services/product.service.js` | 300s | `products` |
| `getPageDataBySlug` | `services/product.service.js` | 300s | `products,sports,categories,brands` |
| `getSeriesBySport` | `services/series.service.js` | 300s | `products,series,sports` |
| `queryBySlugs` | `services/query.service.js` (new) | 60s | `products,sports,categories,brands,series` |
| `getCachedNavbar` | `src/lib/navbarService.js` (new) | 600s | `navbar` |
| `getActiveBanners` | `src/lib/bannerService.js` (new) | 3600s | `banners` |
| `getShowcaseAthletes` | `src/lib/athleteService.js` (new) | 300s | `athletes` |

### 2.2 Removed HTTP self-fetches (server-to-self round-trips)
- **`[sportSlug]/[...slug]`** now calls `queryBySlugs()` directly (a cached DB function)
  instead of `fetch('/api/query')`. `generateMetadata` and the page share the **same
  cached call** → one DB hit instead of two HTTP round-trips. Also removes the fragile
  `NEXT_PUBLIC_BASE_URL` dependency.
- **`BannerSection`** now reads `getActiveBanners()` directly instead of `fetch('/api/banners')`.

### 2.3 Navbar moved to the server
- Navbar data is fetched in the **layout** (`getCachedNavbar()`, in parallel with auth)
  and passed to `<Navbar navData={…} />` as a prop. The client `useEffect` fetch is gone.
- Mega-menu items (sports / categories / brands) and the "جمعه بازار" link converted from
  `window.location.href` / `<a>` to `<Link prefetch>` → **instant SPA navigation** with
  hover/viewport prefetching of the destination's RSC payload.

### 2.4 Home page
- `ShowcaseAthletes` is now fed server-rendered data via props (no `useEffect`, no skeleton flash).
- All home data (`products, slides, sports, athletes, rate`) fetched in a single `Promise.all`.

### 2.5 Product price (critical pricing API) fix
- Server already passes prices **converted to Toman**. `ProductInfo` previously multiplied
  that Toman value by a `rate` of `0` before the price API resolved → showed `۰ تومان`.
  Fixed to render the server price immediately; the discount/flash-sale refines it when
  `/api/product/[id]/price` responds. (That endpoint stays dynamic on purpose — see §3.)

### 2.6 Cache invalidation on writes
`src/lib/revalidate.js` exposes `revalidateContent(tags?)`. It is called from every
content mutation so cached pages refresh immediately after an admin edit instead of
waiting for the revalidate window:
- product create / update / delete
- banner create / update / delete
- sport, category, brand, series create / update / delete

### 2.7 Client router cache + image formats (`next.config.mjs`)
- `experimental.staleTimes` → `{ dynamic: 30, static: 180 }`: once a route is visited or
  prefetched, it is served from the **client router cache** without re-hitting the server
  (this is the "cached after initial load" requirement).
- `images.formats: ["image/avif","image/webp"]` for smaller images / better LCP.

### 2.8 Phase 2 — auth moved to a client island (unlocks static/ISR)
`await cookies()` in `(Site)/layout.js` previously forced the entire public tree to render
dynamically. It was removed:
- New `src/components/features/auth/UserContext.jsx` (`UserProvider` / `useUser`) is a
  client island that reads the user from `/api/auth/profile` (token is httpOnly, so the
  client can't read it directly). It hydrates **optimistically from `localStorage`** to
  avoid a logged-in→out flash, then confirms with the server.
- `Navbar` and `CartDrawer` now consume `useUser()` instead of a server `user` prop.
- `loginAction` returns `{ success, redirectUrl }` and the login page does a **hard
  navigation** (instead of a server `redirect()`), so the island mounts fresh with the new
  auth state. Logout clears the cached `authUser` before reloading.
- Result: `/`, `/products`, `/second-hand` are `○` (Static+ISR); `/products/[slug]`,
  `/[sportSlug]/**`, `/second-hand/[sportSlug]` are `●` (on-demand ISR). See §3.

---

## 3. Rendering strategy (SSR / ISR / CSR) — **implemented**

**Phase 2 done:** `cookies()` was removed from `src/app/(Site)/layout.js`. User state now
lives in a small client island (`UserProvider`, §2.8), so the whole `(Site)` tree is
static/ISR. Verified in the build output:

| Route | Build symbol | Strategy | Why |
|-------|--------------|----------|-----|
| `/` (home) | `○` ISR 1m | **Static + ISR**, cached data | Mostly static blocks; regenerated every 60s |
| `/products` | `○` ISR 1m | **Static + ISR** | Catalog list; filtering is client-side over server data |
| `/products/[productSlug]` | `●` ISR 5m | **SSG on-demand + CSR price island** | First visit renders+caches; live price/discount per-user → client |
| `/[sportSlug]` | `●` ISR 5m | **SSG on-demand**, cached `getPageDataBySlug` | First visit renders+caches |
| `/[sportSlug]/[...slug]` | `●` ISR 5m | **SSG on-demand**, cached `queryBySlugs` | First visit renders+caches |
| `/second-hand` | `○` ISR 10m | **Static + ISR** | Catalog content |
| `/second-hand/[sportSlug]` | `●` ISR 5m | **SSG on-demand** | First visit renders+caches |
| `/p-user/**` | `○`/`ƒ` | **CSR / dynamic** | Per-user, auth-gated, non-cacheable |
| `/p-admin/**` | `○`/`ƒ` | **CSR / dynamic** | Auth-gated dashboards |
| `/api/product/[id]/price`, `/api/cart/price` | `ƒ` | **Dynamic (never cached)** | Depend on auth cookie, flash sales, user role/level |

Legend: `○` Static (prerendered + ISR) · `●` SSG with `generateStaticParams` (on-demand
ISR for params not built ahead) · `ƒ` Dynamic (rendered per request).

How it works now:
- Public pages are served from the **full-route cache** (HTML + RSC payload), revalidated
  on the ISR window, and refreshed instantly on admin writes via `revalidateContent()`.
- The only per-user pieces are **client islands**: the navbar user chip (`UserProvider`)
  and the product price (`/api/product/[id]/price`). They hydrate without blocking the
  cached shell or the LCP.

---

## 3.5 Hotfix — DB connection exhaustion + per-card price storm (June 2026)

**Symptoms (Vercel logs / Atlas alerts):** product pages failing to load;
`MongooseError: Operation \`products.findOne()\` buffering timed out after 10000ms`;
`SSL alert number 80`; Atlas M0 "connections nearing limit" emails.

**Root causes**
1. **`configs/db.js` was unsafe for serverless.** It did `if (readyState >= 1) return;`
   then `try { connect } catch { console.error; /* swallow */ }`. On a failed/slow
   connect it returned anyway, so every caller proceeded and its queries **buffered
   until the 10s timeout**. It also cached nothing and set **no `maxPoolSize`** (Mongoose
   default 100), so each serverless invocation opened its own large pool → the M0
   connection limit was exceeded → the SSL/buffering cascade.
2. **Every `ProductCard` fetched `/api/product/[id]/price` in a `useEffect`.** A catalog
   page with N products fired **N price requests = N DB connections** on every view.

**Fixes**
- **`configs/db.js` rewritten** with the standard cached-global-promise pattern
  (`global._mongooseCache`), `maxPoolSize: 10`, `minPoolSize: 0`, `maxIdleTimeMS: 30000`,
  `bufferCommands: false`, and it now **throws** on connect failure instead of swallowing
  it (so callers don't proceed into a buffering timeout, and `unstable_cache` won't cache
  a broken result). Concurrent cold-start calls share one in-flight promise.
- **Server-side batch pricing.** New `attachListingPrices(products, rate)` in
  `services/priceEngine.js` computes the **anonymous** final price (FlashSale + global/
  product/brand/category/serie discount rules) for an **entire list in just 2 queries**
  and bundles `basePriceToman / finalPriceToman / discountAmount / discountPercent` onto
  each product. It's applied inside the cached reads: `getProducts`, `getHomeProducts`,
  `getPageDataBySlug`, `queryBySlugs`.
- **`ProductCard` no longer fetches.** It reads the baked `*Toman` fields (with a local
  `basePrice * rate` fallback). Result: a catalog page now makes **0** price requests
  instead of N. Per-user accurate pricing still happens on the **product detail page**
  (`ProductInfo`, 1 request) and lazily in `QuickViewModal` (only when opened).
- **Home sliders limited to 10 each.** New `getHomeProducts()` fetches the 20 newest
  products once, prices them, and returns `{ bestSellers: 10, offers: 10 }` (offers =
  discounted first, else newest). The home page no longer pulls the whole catalog.
- **Pagination.** `ProductList` now paginates client-side at **20 items / page**
  (5 rows × 4 cols) with numbered controls, so `/products` and every `/[sportSlug]/**`
  page render one page at a time instead of the full result set. (Client-side paging keeps
  the existing instant filter/search UX; revisit with server-side paging only if the
  catalog grows very large.)

## 4. API audit (consumption)

| API | Finding | Action |
|-----|---------|--------|
| `/api/query` (POST) | Called over HTTP from a server component (self round-trip) + duplicated in `generateMetadata`; `cache:"no-store"` | Replaced with cached `queryBySlugs()` direct call; route kept for external/client callers |
| `/api/navbar` (GET) | Fetched client-side every page; had its own duplicate `unstable_cache` | Navbar now SSR via shared `getCachedNavbar()`; route refactored to reuse the same service (no duplicate cache key) |
| `/api/banners` (GET) | Self-fetched during SSR | Replaced with cached `getActiveBanners()`; route still available |
| `/api/athletes/showcase` (GET) | `force-dynamic`, fetched client-side on home | Now server-fed via cached `getShowcaseAthletes()` |
| `/api/product/[id]/price` | Correct boundary (per-user, dynamic) but consumer flashed `۰ تومان` | Fixed consumer to show server price immediately, then refine |
| `/api/product` (GET) | Heavy `populate` (brand/sport/athlete/category[/variants]) with no cache | Public catalog reads now go through cached `getProducts()`; this route remains for admin/ad-hoc use |

### Suggested follow-ups (not yet done)
- Add MongoDB indexes on the hot filter fields: `Product.isActive`, `Product.slug`,
  `Product.{brand,sport,category,serie,athlete}`, `Slug.slug`, `Sport.order`.
- Consider `.select(...)` projections on list queries (catalog cards don't need
  `longDescription`, full `attributes`, etc.) to shrink payloads.
- For `/api/product/[id]/price`, add `Cache-Control: private` so the browser can reuse it
  briefly across re-renders of the same product.

---

## 5. How to verify
- `npx next build` → compiles clean; route table shows the strategy above.
- Navigate between category/product pages: no full reloads, destinations prefetched.
- Edit a product/banner/sport in admin → public pages reflect it immediately (tag revalidation).
