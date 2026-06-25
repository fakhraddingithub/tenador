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
npm run test:db      # Test MongoDB connection
npm run check:mongodb # Inspect MongoDB collections/state

# Database migrations (run when needed)
npm run migrate:used-products
npm run migrate:coach-codes

# Background workers (must run separately from the web process)
npm run worker:prices
npm run worker:discounts
npm run worker:installment-reminders   # Sends installment due-date reminders
```

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

### Slug System

`SlugRegistery` model maps dynamic URL segments (sport/category/brand slugs) to their entity types. `actions/registerSlug.js` is a server action that creates entries on entity creation. This powers ISR revalidation — when a slug is revalidated, the correct entity page is rebuilt.

### Feature Subsystems

Beyond the storefront, several self-contained subsystems each span a model + service + API + admin/site UI. Start from the service file (the entry point) when working on one:

| Subsystem | Entry point(s) | Notes |
|---|---|---|
| Events / campaigns | `services/event.service.js`, `services/eventProductResolver.js`, `models/Event.js` | Campaign platform with theme/effect system and resolver-driven product selection |
| Admin notifications | `services/notificationService.js`, `models/Notification.js` | Bell/sidebar UI; beware the payment dual-path/webhook early-return gotcha |
| User broadcasts | `services/userNotificationService.js`, `models/UserNotification*.js` | Admin→user broadcasts with watermark read-tracking |
| Reviews / comments | `services/comment.service.js`, `models/Comment.js` | Moderated, one-per-product, "verified purchase" badge |
| Instagram DM inbox | `services/instagramService.js`, `src/lib/instagram.js`, `models/Instagram*.js` | Meta webhook + send API + chat UI; 24h messaging window |
| CMS info pages | `services/pageContent.service.js`, `src/lib/pageDefaults.js`, `models/PageContent.js` | Block-based editor; `SectionRenderer` renders blocks; `ContactMessage` inbox |
| Coach system | `models/CoachCredit.js`, `models/CoachWalletTransaction.js`, `api/admin/coach-*` | Coach applications, codes, credits/wallet |
| Second-hand / used | `models/UsedProduct.js`, `api/admin/used-products` | Used-product listings with health scale |
| Installments | `models/Installment.js`, `api/installments`, `workers/installmentReminderWorker.js` | Check-based installment payments + due-date reminder worker |
| Order flows | `src/lib/flowTraversal.js`, `p-admin/admin-order-flows`, `models/OrderFlow*` | Admin-defined DAG of order stages; traversal turns the graph into a customer-facing step sequence |
| Financial analytics | `services/analyticsService.js`, `p-admin/financial` | Revenue/collected/outstanding/collect-rate via aggregation pipelines (no N+1); overdue from installment-check due dates |
| Web push | `src/lib/push.js`, `models/PushSubscription.js` | Server-side Web Push via VAPID; Node-only (needs native crypto); auto-prunes expired subscriptions (404/410) |

### State Management

- **Server state:** `unstable_cache` + on-demand revalidation (described above)
- **Auth state:** React Context via `UserProvider` / `useUser()`
- **UI state:** Zustand v5 store in `src/lib/store.js` (`useDashboardStore`)

### Key Conventions

- **RTL/Persian first:** The app is fully right-to-left. UI components use Vazirmatn font (loaded in `src/app/globals.css`). Always consider RTL layout when building new UI. Farsi inline comments are common throughout the codebase.
- **Images via Cloudinary:** All product, athlete, and brand images are uploaded to and served from Cloudinary. The `next.config.mjs` remote pattern allows `res.cloudinary.com`. Never use local `/public` for user-uploaded content.
- **Tailwind v4:** No `tailwind.config.js` — configuration is done via CSS variables in `globals.css`. Primary color: `#aa4725`, secondary: `#ffbf00`.
- **Mixed JS/JSX:** Most files are `.js` or `.jsx`, not TypeScript. `tsconfig.json` exists but `strict` is off.
- **Path aliases:** `@/*` maps to `src/*`; `base/*` maps to the repo root.

### Environment Variables

Required in `.env` (no `.env.example` exists):

```
MONGODB_URI_TENADOR / MONGODB_URI_LOCAL / MONGODB_URI_WAREHOUSE
CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET / CLOUDINARY_URL
AccessTokenPrivateKey / RefreshTokenPrivateKey
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_BASE_URL / NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_LOGO_URL
EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASS / EMAIL_FROM / ADMIN_EMAIL
BULLMQ_QUEUE / BATCH_SIZE / PRECOMPUTE_CONCURRENCY / PRICE_CACHE_TTL
REDIS_URL                                                    # BullMQ connection (workers)
NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT   # Web push
INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID / INSTAGRAM_APP_SECRET / INSTAGRAM_WEBHOOK_VERIFY_TOKEN
```
