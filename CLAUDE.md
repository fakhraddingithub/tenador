# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run lint         # ESLint (next/core-web-vitals)
npm test             # Jest test suite (node env; tests/setup.js spins up mongodb-memory-server)
npm test -- tests/paymentWorkflow.test.js   # Run a single test file
npm test -- -t "name of test"                # Run tests matching a name
npm run test:sender-address                  # Sender-address validation (print flow)
npm run test:db      # Test MongoDB connection
npm run check:mongodb # Inspect MongoDB collections/state

# Database migrations (run when needed)
npm run migrate:used-products
npm run migrate:coach-codes
npm run migrate:category-sport   # Drops global slug unique indexes, adds per-sport compound indexes (required in prod)
npm run check:tracking-variant-refs        # Dry-run: warehouse barcodes whose variantRef points at a deleted variant
npm run repair:tracking-variant-refs       # Repoint them at the current variant (matched via the warehouse's variantKey snapshot)
npm run check:order-variant-snapshots      # Dry-run: order lines showing a blank variant (deleted variant, no snapshot)
npm run backfill:order-variant-snapshots   # Fill variantSnapshot where another order line proves the attributes
npm run check:article-image-dimensions    # Dry-run: report article/brand image blocks missing width+height
npm run migrate:article-image-dimensions  # Backfill those dimensions (idempotent); revalidate the `articles` tag afterwards
npm run check:remove-seller-role          # Dry-run: data still referencing the removed `seller` role
npm run migrate:remove-seller-role        # Move those references to `store` (users, discount rules, broadcasts, review-credit config)

# Background workers (must run separately from the web process)
npm run worker:prices
npm run worker:discounts
npm run worker:installment-reminders   # Sends installment due-date reminders
npm run worker:review-followup         # Sends "did your order arrive?" follow-up 3 days after delivery
```

`installment-reminders` and `review-followup` are periodic scans (not BullMQ), designed to be triggered by an external scheduler rather than run continuously. In production they run via **Vercel Cron** (`vercel.json`), which calls `GET /api/cron/installment-reminders` and `GET /api/cron/review-followup` — both check an `Authorization: Bearer $CRON_SECRET` header (Vercel sets this automatically when `CRON_SECRET` is configured as a project env var) and 401 otherwise. The `npm run worker:*` scripts remain for local/manual runs.

## Architecture

### Route Groups

Three route groups under `src/app/`:

- `(Site)/` — Public storefront (sports, products, articles, athletes, auth, second-hand)
- `(Admin-Panel)/p-admin/` — Admin dashboard, protected by role check in each route
- `(User-Dashboard)/p-user/` — User account pages, protected by `middleware.js`

`middleware.js` only guards `/p-user/*` — it redirects to `/login-register` if the `accessToken` cookie is absent. Admin routes validate the admin session inside their own API handlers.

### Authentication

Custom JWT, **not next-auth**. Flow:

1. Login/register via `/api/auth/*` routes (phone+password or Google OAuth)
2. Server sets `accessToken` + `refreshToken` as httpOnly cookies (15-day expiry)
3. Client reads current user via `GET /api/auth/profile`
4. `UserProvider` (client component in `src/components/auth/`) wraps the app; provides `useUser()` hook
5. Optimistic hydration from localStorage prevents flash of logged-out state

Token utilities live in `utils/auth.js` (bcryptjs for passwords, jsonwebtoken for tokens).

**Admin authorization:** API handlers gate admin access by calling `requireAdmin()` from `src/lib/requireAdmin.js`. It re-checks `user.role === "admin"` via a fresh DB lookup — the JWT alone is **not** trusted for role. `src/lib/permissions.js` is the single source of truth for the fine-grained permission registry (keys like `products.edit`), stored on `AdminRole` as an array of string keys; adding a module/permission means editing only that file (no schema change). Note enforcement of these per-permission keys is staged and may not be applied on every route yet — confirm before relying on it.

### Database

Mongoose v9 connecting to MongoDB. Connection is cached in `global._mongooseCache` (module-level) to survive hot-reload in dev and prevent connection exhaustion in serverless. Config is in `configs/db.js` with pool size tuned for Vercel (`maxPoolSize: 5`).

All models are in `models/`. **Always import `models/registerModels.js` before using any model** — it registers all schemas as side-effects to prevent tree-shaking from dropping model definitions at build time.

Three separate MongoDB URIs: `MONGODB_URI_TENADOR` (primary), `MONGODB_URI_LOCAL` (dev), `MONGODB_URI_WAREHOUSE` (separate warehouse DB).

### Caching Strategy

Server data is cached with Next.js `unstable_cache` in `services/` and `src/lib/*Service.js` files:

| Layer | TTL | Tags |
|---|---|---|
| Navbar | 600s | `navbar` |
| Banners | 3600s | `banners` |
| Product by slug | 300s | `products` |
| Page data by slug | 300s | `products,sports,categories,brands` |
| Series | 300s | `products,series,sports` |

After any admin mutation, call `revalidateContent(tags)` from `src/lib/revalidate.js` to purge relevant cache tags immediately.

**Do not use `fetch()` inside server components to call your own API routes.** Call service functions or DB queries directly — this avoids a double round-trip (HTTP + DB) and was a deliberate performance fix.

### Pricing

`services/priceEngine.js` computes prices server-side (base price in Toman, discount rules, exchange rate conversion from USD). Results are precomputed and stored in `PriceCache` model. BullMQ workers (`workers/priceWorker.js`, `workers/discountWorker.js`) handle async recalculation when products or discount rules change.

### Variant identity

**A variant's `_id` is a stable, externally-referenced identity — never regenerate it.** It is referenced from
`order.items[].variant`, from `itemtrackings.variantRef` in the separate warehouse DB, and from
`flowSelections[].selectedVariant`.

The product PUT route (`src/app/api/product/[productId]/route.js`) used to `deleteMany` every variant and recreate
them on each save. Because the admin edit form always sends `variantOptions` ("so backend can sync"), *any* product
edit — even changing only the description — minted fresh `_id`s for identical attribute combinations and silently
broke every external reference: order lines rendered their variant as "unspecified", and scanning a barcode onto an
order failed with «این بارکد متعلق به واریانت دیگری از این محصول است» even though barcode and order line were the
same variant.

`src/lib/variantReconcile.js` now reconciles instead. The **attribute combination is the identity**, keyed with the
shared `makeComboKey` from `src/lib/variantKey.js` (order-independent, collision-free, used by the client too):

| state | action |
|---|---|
| combination exists and is still wanted | update in place — `_id` **and** `sku` preserved |
| wanted but missing | create |
| exists but no longer wanted | delete (an explicit admin action) |

Gotchas baked into the implementation:

- **Writes happen before `product.save()`, deletes strictly after.** A mid-request failure can then never leave the
  product without variants.
- **Changed variants are written via `doc.save()`, not `updateOne`.** `updateOne` skips the `pre("validate")` hook on
  `models/Variant.js` that checks attributes against the category's `variantAttributes`; the old create-everything
  path always ran it, so bypassing it would silently persist invalid data.
- **Existing variants are read with `Variant.find({ productId })`, not from `product.variants`.** This re-adopts any
  variant orphaned by earlier bugs instead of leaking it forever.
- **`variantOptions` absent ≠ `{}`.** Absent means "this request isn't about variants" and leaves them untouched;
  `{}` means "no variants". Previously both blanked `product.variants` while leaving the documents orphaned.
- A payload with no `category` never nulls a kept variant's required `categoryId`.

Tests: `npm run test:variant-reconcile` (pure planner) and `npm run test:variant-identity` (real mongoose + schema
constraints, asserts `_id`s survive an edit). Both must stay green — they are the regression guard for this bug.

Note that a *deliberate* combination removal still deletes the variant and so still dangles old references; that is
why `order.items[].variantSnapshot` exists (written at checkout since 2026-06-25, read by `VariantSummary` with a
fallback to `variant.attributes`). Orders placed before that date have no snapshot and display blank if their variant
was deleted — see the two `*variant*` scripts above.

### Order EUR pricing (independent of Toman)

An order carries a **manual** EUR amount (`order.priceEUR`) plus an EUR payment history
(`order.paymentsEUR`) — see `src/app/api/admin/orders/[orderId]/eur/route.js`. Nothing here converts
from Toman; the two currencies never derive from each other.

Each order line also carries `order.items[].priceEUR` — a **unit** EUR price the admin types by hand
in the order screen. It is deliberately *not* the product's base/catalog price and is never derived
from the product; it is an order-line snapshot, set only via
`PATCH /api/admin/orders/[orderId]/eur/item` (gated by `orders.setCurrency`).

`services/orderEurRecalc.js` holds the one rule that matters:

| items with a EUR price | what happens to `order.priceEUR` |
|---|---|
| at least one | overwritten with `Σ(priceEUR × quantity)` |
| none | **left untouched** — never zeroed, never nulled |

That second row is the backward-compatibility guarantee: legacy orders (which have only a manual
total and no item prices) can never be silently corrupted. The total therefore stays manually
editable, but any later item-level EUR change recomputes it. The items route
(`.../[orderId]/items`) calls `applyOrderEurTotal` too, since a quantity change or line deletion
changes the sum — under the same "no item prices → touch nothing" rule.

Store-role users (`role === "store"`) see each item's EUR price alongside the Toman price in
`src/components/modules/orders/index.jsx`, but only for lines the admin actually priced.

Tests: `npm run test:order-item-eur`.

### Order address printing (sender addresses)

The "چاپ برگه آدرس" button on the admin order screen opens
`SenderAddressModal` → the admin picks/adds a **sender address** → an
`<a target="_blank" rel="noopener noreferrer">` opens `/order-print/[orderId]?sender=<id>`.

**Why a separate route and not the old popup.** The previous implementation was
`window.open("", "_blank")` + `document.write`. That popup was same-origin *with an
opener*, so it shared the admin page's browsing-context group: `print()` inside it
blocked the whole group, and closing the dialog left the admin panel half-dead
(animations frozen, handlers unresponsive). The fix is architectural, not a patch —
never reintroduce a print popup, an app-wide `@media print` hide/restore, or any
DOM swapping on the admin page:

| piece | why it matters |
|---|---|
| `src/app/(Print)/layout.jsx` | its **own root layout** — no globals.css, no Tailwind, no admin theme, no providers. A print sheet measured in mm must not move when the panel's theme changes. |
| `rel="noopener"` on the link | puts the print tab in its own context group; it holds no reference to the panel and the panel holds none to it. Closing/canceling/refreshing it cannot touch panel DOM, state, routing or styles. |
| an `<a>`, not `window.open` | popup blockers never block a user's link navigation, and `window.open(..., "noopener")` returns `null` so a blocked popup would be undetectable anyway. |
| `AddressSheetStyles.jsx` | all CSS inline in one `<style>`; `@page { size: A4 landscape }`. Sender is placed `top/left`, recipient `bottom/right` with `position: absolute` — a CSS grid would flip the columns in this RTL document. |

**Sender addresses are not customer addresses.** `models/SenderAddress.js` is its own
collection: no `user` ref, shop-wide, and it is **never written onto an order** — the
selection is only a URL parameter, so printing changes no order data (Toman, EUR,
items, status, `address.snapshot` all untouched). `Address` (customer) is unrelated and
was not modified. Sender phones deliberately accept landlines, so validation lives in
`src/lib/senderAddressForm.mjs`, not the customer `addressForm.mjs` (which demands an
`09…` mobile).

Permissions — note the deliberate asymmetry:

| operation | key |
|---|---|
| `GET /api/admin/sender-addresses`, the print page itself | `orders.view` |
| `POST` / `PATCH` / `DELETE` on sender addresses | `orders.manageSenders` (new) |

Reading is on `orders.view` on purpose: gating it behind the new key would have taken
the *existing* ability to print away from every current admin role the moment the key
was added. `/order-print/*` is not under `/p-admin`, so `src/middleware.js` never sees
it — the page enforces `orders.view` itself via `getAdminContext()` + `hasPermission`,
and answers `notFound()` (not 403) so the route's existence isn't leaked. It is also
in `RESERVED_ARTICLE_ROOTS`.

Tests: `npm run test:sender-address`.

### Slug System

`SlugRegistery` model maps dynamic URL segments (sport/category/brand slugs) to their entity types. `actions/registerSlug.js` is a server action that creates entries on entity creation. This powers ISR revalidation — when a slug is revalidated, the correct entity page is rebuilt.

**Categories are scoped under a sport.** A `Category` has a required `sport` ref, and the slug is unique only within that sport (compound index `{ sport, slug }`) — two sports can each have a `racket` category. The public URL structure is nested: `/[sportSlug]/[categorySlug]` (e.g. `/tennis/racket`). Correspondingly `SlugRegistery` is no longer globally unique on `slug`; uniqueness is `{ type, slug, filterValue }`. Existing prod data must be migrated with `npm run migrate:category-sport`, which drops the old global `slug_1` indexes and reports any categories still missing a sport (these stay hidden from storefront/sitemap until assigned one).

### Feature Subsystems

Beyond the storefront, several self-contained subsystems each span a model + service + API + admin/site UI. Start from the service file (the entry point) when working on one:

| Subsystem | Entry point(s) | Notes |
|---|---|---|
| Events / campaigns | `services/event.service.js`, `services/eventProductResolver.js`, `models/Event.js` | Campaign platform with theme/effect system and resolver-driven product selection; public pages live at `/collection/[slug]` (old `/events` paths 301-redirect in `next.config.mjs`) |
| Articles / blog | `services/article.service.js` (admin CRUD), `services/publicArticle.service.js` (public), `models/Article*.js` | Block-based articles (same block idea as CMS pages) with categories, tags, revision snapshots, and slug-change redirects; article-category slugs live at the URL root, so they are collision-checked against sport/brand slugs and the reserved-route list in `utils/articleRoutes.js`; supports scheduled publishing (`publicArticleFilter`) |
| Admin notifications | `services/notificationService.js`, `models/Notification.js` | Bell/sidebar UI; beware the payment dual-path/webhook early-return gotcha |
| Admin audit log | `models/auditPlugin.js`, `src/lib/adminAuditScope.js`, `src/lib/auditEntities.js`, `models/AdminActivity.js` | Append-only ledger of what each admin actually changed — see **Admin audit log** below |
| User broadcasts | `services/userNotificationService.js`, `models/UserNotification*.js` | Admin→user broadcasts with watermark read-tracking |
| Reviews / comments | `services/comment.service.js`, `models/Comment.js` | Moderated, one-per-product, "verified purchase" badge |
| Support tickets | `models/Ticket.js`, `models/TicketMessage.js`, `api/tickets`, `api/admin/tickets` | Department/priority ticket system with per-ticket chat (user dashboard + admin panel), attachments via `/api/upload`, email notice on admin reply |
| CMS info pages | `services/pageContent.service.js`, `src/lib/pageDefaults.js`, `models/PageContent.js` | Block-based editor; `SectionRenderer` renders blocks; `ContactMessage` inbox |
| Coach system | `models/CoachCredit.js`, `models/CoachWalletTransaction.js`, `api/admin/coach-*` | Coach applications, codes, credits/wallet |
| Second-hand / used | `models/UsedProduct.js`, `api/admin/used-products` | Used-product listings with health scale |
| Installments | `models/Installment.js`, `api/installments`, `workers/installmentReminderWorker.js` | Check-based installment payments + due-date reminder worker |
| Order flows | `src/lib/flowTraversal.js`, `p-admin/admin-order-flows`, `models/OrderFlow*` | Admin-defined DAG of order stages; traversal turns the graph into a customer-facing step sequence |
| Financial analytics | `services/analyticsService.js`, `p-admin/financial` | Revenue/collected/outstanding/collect-rate via aggregation pipelines (no N+1); overdue from installment-check due dates |
| Web push | `src/lib/push.js`, `models/PushSubscription.js` | Server-side Web Push via VAPID; Node-only (needs native crypto); auto-prunes expired subscriptions (404/410) |

### Admin audit log

Records are built from the **Mongoose layer**, not from route handlers. The
permission gate runs before a handler and only knows the permission key, so its
record can only ever say "an authorized write happened"; instrumenting all 121
admin routes by hand would go stale the first time someone adds a route. The
only layer every mutation passes through — and the only one that sees before and
after values — is Mongoose.

Flow of one admin write request:

1. `requireAdminPermission()` calls `openAuditScope()` **synchronously, before
   its first `await`**. This ordering is load-bearing: `AsyncLocalStorage.enterWith`
   attaches to the current async frame, and until the first `await` that frame
   still belongs to the *handler*. Move it after an `await` and the scope is
   invisible to everything downstream. A test in `tests/adminRbac.test.mjs` locks
   the order in.
2. The gate activates the scope only for a **write** key. Public traffic, workers
   and read-only admin requests never open one, so they cost nothing.
3. `models/auditPlugin.js` (a global Mongoose plugin) snapshots documents on
   `init` and emits an event from each `post` hook — so an event exists only when
   the write really happened. Events written inside a transaction that later
   aborted are dropped by checking `session.transaction.state`.
4. `after()` fires `flushAuditScope()` once the response is sent. It collapses all
   the request's mutations into **one** record: the highest-`priority` entity is
   the subject, the rest go in `related`. With no mutations it writes the old
   `authz.granted` / `attempted` record, so pre-existing records keep their meaning.

Gotchas:

- **`mongoose.plugin()` only affects schemas compiled after it runs.** Adding hooks
  to an already-compiled model silently does nothing. Hence `src/instrumentation.js`
  (runs before everything) plus `models/auditPlugin.js` being the first import in
  `models/registerModels.js`.
- **The ALS store lives on `globalThis`.** Next bundles the module into more than one
  layer; a per-module `new AsyncLocalStorage()` gave instrumentation and the routes
  separate stores, and the plugin silently collected nothing.
- Routes that write their own record via `auditor()` call `markAuditHandled()`
  automatically, which suppresses the generic one.
- Add an entity to `AUDIT_ENTITIES` for a better label/diff; coverage does **not**
  depend on it — unknown models fall back to a generic descriptor. Add noisy or
  side-effect models to `AUDIT_IGNORED_MODELS` instead.

```bash
npm run test:admin-audit     # plugin + flush against a real replica set
npm run verify:audit-trail   # real HTTP against a built app on a throwaway DB
```

### State Management

- **Server state:** `unstable_cache` + on-demand revalidation (described above)
- **Auth state:** React Context via `UserProvider` / `useUser()`
- **UI state:** Zustand v5 store in `src/lib/store.js` (`useDashboardStore`)

### Key Conventions

- **RTL/Persian first:** The app is fully right-to-left. UI components use Vazirmatn font (loaded in `src/app/globals.css`). Always consider RTL layout when building new UI. Farsi inline comments are common throughout the codebase.
- **Images via ImageKit (migrated from Cloudinary):** Uploads go through `POST /api/upload` using the ImageKit SDK; coach-document PDFs are uploaded as private files and served through the signed-URL proxy at `src/app/api/files/pdf/route.js`. `next/image` uses a custom loader (`src/lib/imagekitLoader.js`) so Vercel image optimization is bypassed entirely; the loader still passes through legacy `res.cloudinary.com` URLs until the DB migration (`scripts/migrate-cloudinary-to-imagekit*.mjs`) is fully done, and skips transforms for SVGs (adds `tr=orig-true` to stop ImageKit rasterizing them). Never use local `/public` for user-uploaded content.
- **React Compiler is enabled** (`reactCompiler: true` in `next.config.mjs`) — don't add manual `useMemo`/`useCallback` for plain render memoization.
- **Tailwind v4:** No `tailwind.config.js` — configuration is done via CSS variables in `globals.css`. Primary color: `#aa4725`, secondary: `#ffbf00`.
- **Mixed JS/JSX:** Most files are `.js` or `.jsx`, not TypeScript. `tsconfig.json` exists but `strict` is off.
- **Path aliases:** `@/*` maps to `src/*`; `base/*` maps to the repo root.

### Environment Variables

Required in `.env` (no `.env.example` exists):

```
MONGODB_URI_TENADOR / MONGODB_URI_LOCAL / MONGODB_URI_WAREHOUSE
IMAGEKIT_PUBLIC_KEY / IMAGEKIT_PRIVATE_KEY / IMAGEKIT_URL_ENDPOINT / NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT
CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET   # legacy — only the one-off Cloudinary→ImageKit migration scripts need these
AccessTokenPrivateKey / RefreshTokenPrivateKey
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_BASE_URL / NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_LOGO_URL
EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASS / EMAIL_FROM / ADMIN_EMAIL
BULLMQ_QUEUE / BATCH_SIZE / PRECOMPUTE_CONCURRENCY / PRICE_CACHE_TTL
REDIS_URL                                                    # BullMQ connection (workers)
NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT   # Web push
CRON_SECRET                                                  # Authenticates Vercel Cron requests to /api/cron/*
```
