# Claude Code Handoff — Admin RBAC, Visibility, Membership, and Audit

> **Owner:** Claude Code. Continue the implementation, analysis, security review,
> decisions, and verification yourself. Codex is intentionally not the reviewer for
> the remaining work because its weekly quota is nearly exhausted.
>
> **Repository:** `C:\Users\mosal\Desktop\projects\tenador`
> **Branch / starting commit:** `master` / `8ac0a97`
> **Handoff time:** 2026-08-16 12:37 Europe/Paris
> **Working tree:** intentionally dirty with unfinished RBAC work. Preserve it.

## 1. Non-negotiable user outcome

Implement a complete, least-privilege admin system across the *entire* admin panel:

1. An admin is not a separate manually typed identity. To add an admin, select an
   existing `User`, assign an admin role, and optionally assign explicit grants or
   denials. Admin membership must not overwrite the user's business role (coach,
   seller, user, etc.).
2. Remove every way to promote a user to admin from the user list and user details.
   `User.role = "admin"` must no longer be a supported admin-management mechanism.
   Only Admin Management may grant/revoke panel membership.
3. Enforce fine-grained permissions on every admin API operation. A valid admin token
   alone must never grant the whole panel.
4. Hide every unauthorized page, navigation item, card, tab, button, dropdown action,
   bulk action, shortcut, badge, notification, and capability hint. Unauthorized
   capabilities must leave no discoverable UI trace. Direct URL/API access must also
   be denied server-side. Removing elements must not break RTL layout or responsive
   design.
5. Clicking an admin in Admin Management must open a detailed view with:
   - linked user identity and membership status;
   - assigned role, effective permissions, explicit grants/denials;
   - human-readable pages/capabilities currently accessible;
   - a detailed, filterable activity timeline of everything that admin did in the
     panel, with exact action/resource/time/result and safe before/after details.
6. Reconcile the permission registry against every admin page, nested page, API, and
   action. Do not fix only the examples. `warehouse` is known stale because the panel
   has no warehouse module. Financial capabilities currently missing from the old UI
   include discounts/coupons, installments, and other nested financial operations.
   Audit the whole panel exhaustively and add/remove/split keys where needed.
7. Preserve all unrelated behavior. Do not break storefront/user flows, mixed-use
   endpoints such as ordinary user uploads, caching/revalidation, order/payment
   workflows, or existing business roles.

## 2. How to work (Claude owns implementation *and* review)

Work in bounded batches. For every batch:

1. Inspect callers, models, services, routes, UI, and existing tests before editing.
2. State the exact batch scope and security invariants.
3. Implement only that scope.
4. Run focused tests and lint.
5. Perform a separate adversarial review pass as if reviewing someone else's patch:
   check horizontal/vertical privilege escalation, branch-dependent authorization,
   malformed IDs/bodies, booleans represented as strings, concurrency/write-skew,
   stale UI links, direct URL access, information leakage, and unrelated behavior.
6. Fix every finding, rerun verification, then report changed files, evidence, and
   remaining risks before starting the next batch.

If Claude Code supports internal agents/reviewer roles, use one for an independent
read-only security review after each implementation batch. Claude remains responsible
for validating the review and making the final decision. Do not wait for Codex review.

Do not accept a claim such as "tests should pass". Run the command and capture the
actual result. Never reduce scanner/test scope merely to get green output.

## 3. Safety boundaries

- Do **not** run any production/data migration with `--apply` until the migration is
  complete, dry-run output is understood, ambiguity is resolved, rollback is defined,
  and the final implementation is verified.
- Do **not** deploy, push, or commit unless the user explicitly asks. Keep changes in
  the working tree.
- Never use `git reset --hard`, destructive checkout, or overwrite unrelated user
  changes.
- Preserve public/user behavior. `/api/upload` is mixed-use and must not receive a
  coarse admin-only gate.
- Do not log passwords, tokens, cookies, OTPs, full payment secrets, private document
  URLs, or unrestricted request bodies in the activity log.
- Authorization must fail closed for duplicate memberships, missing linked users,
  banned users, inactive/revoked membership, invalid permission keys, missing
  protected roles/sentinels, and transaction-unavailable invariant mutations.
- Always keep at least one **usable** full-access admin: active membership + protected
  full-access role + linked existing non-banned user.

## 4. Architecture and repository rules already established

- Custom JWT; admin APIs previously used `src/lib/requireAdmin.js` and checked only
  `User.role === "admin"`.
- `src/lib/permissions.js` is the intended single source of truth for permission keys.
- Import `models/registerModels.js` before using models where repository convention
  requires it.
- RTL/Persian-first UI, Tailwind v4, React Compiler enabled. Do not add unnecessary
  `useMemo`/`useCallback`.
- Admin pages: `src/app/(Admin-Panel)/p-admin/**`.
- Admin APIs: all `src/app/api/admin/**/route.js`, plus explicitly inventoried
  admin-facing/admin-only handlers outside that tree.
- Call cache revalidation after existing mutation flows as before.

## 5. Work completed before handoff

### Foundation created

The dirty working tree includes work in or around:

- `models/Admin.js`
- `models/AdminRole.js`
- `src/lib/permissions.js`
- `src/lib/adminContext.js`
- `src/lib/adminGuards.js`
- `src/lib/requireAdminPermission.js`
- `src/lib/apiPermissions.js`
- `src/lib/superAdminInvariant.js`
- `scripts/auditAdminRbac.mjs`
- `scripts/verify-admin-auth.mjs`
- `tests/adminRbac.test.mjs`
- Batch-1 routes under admins, roles, permissions, users, admin notifications, and
  user notifications.

Design direction already implemented:

- `Admin` represents a one-to-one panel membership linked to `User`.
- Effective permissions are live:
  `(role.permissions ∪ permissionGrants) − permissionDenials`.
- A protected `AdminRole` with stable `systemKey` and `isFullAccess` represents full
  access; future registry keys are automatically included.
- Revocation is soft (`isActive:false` plus audit metadata), not hard deletion.
- `requireAdminPermission` distinguishes unauthenticated `401` from authenticated but
  unauthorized `403`.
- Branch-aware resolvers prevent one coarse key from authorizing multi-operation
  endpoints.
- A static manifest/scanner inventories all in-scope admin handlers and verifies exact
  permission-gate wiring.

### Inventory baseline

Initial scope was **184 handlers**:

- 136 handlers across 82 files under `/api/admin`;
- 48 explicit admin-facing/admin-only handlers outside `/api/admin`.

After the first Batch-1 conversion, the scanner intentionally still reported exactly
**166 remaining violations** and no Batch-1 residue. Do not treat scanner exit 1 as a
regression until all batches are converted; track the count monotonically downward and
ensure completed batch routes never reappear.

### Database audit performed safely

Only dry-run/read-only audit was performed:

- 8 legacy users had `User.role === "admin"`;
- 0 linked Admin memberships existed at that time;
- applying migration was intentionally blocked because legacy permission data was
  ambiguous.

The temporary legacy fallback grants full access only when a legacy admin has no Admin
membership. This prevents immediate lockout but means fine-grained enforcement is not
fully real for those 8 accounts until migration. Duplicate, inactive/revoked, missing,
or banned membership situations must fail closed. Remove the legacy fallback only in a
safe final migration/cutover phase.

### Last independently verified results before the interrupted correction

- `node --test tests/adminRbac.test.mjs` => **91/91 passed**.
- scoped lint => passed (as reported and previously independently checked).
- `npm run verify:admin-auth` => expected exit 1 with exactly **166** unconverted
  handlers.
- `git diff --check` => clean.
- `npm test` is not a reliable global signal yet because the repository already lacks
  `tests/setup.js`; do not misattribute that pre-existing failure to RBAC work. Fixing
  or replacing that setup is allowed only if done narrowly and verified.

## 6. CRITICAL: correction round is currently interrupted and inconsistent

Claude hit its session quota while correcting Batch 1. Resume here **before any new
batch**. Do not run/deploy the project until this is resolved.

### Finding A — sentinel write was silently stripped

`src/lib/superAdminInvariant.js` wrote `invariantTouchedAt`, but that field did not
exist in the strict `AdminRole` schema. Mongoose stripped the update, so the sentinel
did not create a write conflict and concurrent requests could still remove two
different super-admins (write skew).

The interrupted edit added `AdminRole.invariantRevision` (`Number`, default 0,
`select:false`) and began changing imports in `superAdminInvariant.js`, but the helper
may still write the old `invariantTouchedAt`. Finish and verify:

- locate the protected sentinel using `systemKey`, `isSystem:true`, and
  `isFullAccess:true`;
- `$inc: { invariantRevision: 1 }` inside the same transaction;
- verify exactly one sentinel document matched/wrote; otherwise fail closed;
- perform the target mutation with the same session;
- recount usable full-access admins after mutation with the same session;
- throw/abort if zero remain;
- require replica-set/sharded transaction support and fail closed if unavailable;
- use retry-safe transaction semantics and preserve returned mutation result.

### Finding B — banning the last super-admin bypasses the invariant

`PATCH /api/admin/users/[userId]` can currently set `isBanned`, which can make the last
usable super-admin unusable without calling `withSuperAdminInvariant`. Fix it so any
mutation containing `isBanned` saves the `User` inside the same protected transaction
and returns meaningful 409/503 responses. Decide explicitly whether self-ban should be
disallowed; at minimum, last-super ban must be impossible.

Also harden this route:

- `isBanned` must be a real boolean; reject strings such as `"false"` with 422;
- `walletBalance` must be a finite, valid, nonnegative value according to existing
  domain rules; never silently coerce garbage to zero;
- `level` must be finite and nonnegative according to domain rules;
- malformed `userId` must return controlled 404/422, not CastError => 500;
- `role:"admin"` must always be denied here.

### Required real concurrency test

`mongodb-memory-server@10.4.3` is installed. Add an integration test using
`MongoMemoryReplSet` that runs the **real production invariant helper** and concurrent
transactions against two usable super-admins. It must prove:

- at most one of two concurrent destructive mutations commits;
- at least one usable full-access admin remains;
- missing/malformed sentinel fails closed;
- unavailable transaction support fails closed;
- user-ban and membership deactivate/role-change/revoke paths cannot bypass it.

The test must execute real replica-set transactions, not mock the count or merely test
a pure helper. The interrupted edit changed invariant-helper imports from aliases to
relative `.js` paths to make direct Node integration testing possible; validate those
imports against both Node tests and Next build.

## 7. Batch-1 acceptance checklist after correction

Re-review all Batch-1 routes, not only the two findings:

- Admin POST/PUT/DELETE: exact action keys, strict body types, ObjectId validation,
  role assignability, no privilege escalation, no self/stronger-admin management,
  explicit grants/denials requiring `admins.managePermissions`, soft revoke and
  idempotency, invariant coverage.
- Roles: protected role immutable, stronger role cannot be edited/deleted by weaker
  actor, requested permissions must be a subset of actor permissions, malformed IDs
  controlled.
- Permissions endpoint: correct `any`/`all` mode and no registry leakage beyond an
  authenticated admin where appropriate.
- Users: admin promotion denied, wallet/ban/profile/business-role actions have distinct
  keys, strict validation, last-super invariant.
- Notifications: items/counts/contact counters filtered by effective permissions;
  unknown notification types hidden; mark-read constrained even for `ids` and
  `all:true`; no cross-module information leak.
- Scanner: branch resolver is imported, called after identity gate, checked for
  `allowed`, and wired exactly to `requireAdminPermission` with the declared mode.

Run at least:

```bash
node --test tests/adminRbac.test.mjs
# plus the real MongoMemoryReplSet integration test command
npm run verify:admin-auth
npm run lint -- <scoped changed files, if supported by this repo>
git diff --check
```

Do not start the next batch until Batch 1 is genuinely accepted.

## 8. Remaining implementation phases

### Phase 2 — enforce every API operation

Convert all remaining 166 handlers in bounded, coherent batches. Suggested grouping:

1. Catalog/home: products, variants, sports, categories, brands, series, limited
   editions, athletes, banners/sliders/home settings.
2. Orders/payments/financial: orders and nested actions, payment approve/reject/edit,
   coupons, discounts, quantity discounts, exchange rate, installments, installment
   balance, analytics, order flows.
3. Content/campaigns: articles, article CMS/revisions/autosave/restore/duplicate,
   categories/tags, pages, events and previews/status/duplicate.
4. People/support/moderation: coaches/applications/credits/wallet, tickets/messages,
   comments, contact messages, used products/health cards.
5. Explicit admin-only routes outside `/api/admin`, using the manifest. Do not gate
   mixed public/user behavior accidentally.

For each mutation, choose an operation-specific permission key. GET/list/detail/export
may require distinct keys when data sensitivity differs. Dynamic endpoints must use
branch-aware authorization. Gate before sensitive database reads whenever possible.

The scanner must end at zero and contain tests that fail when a route is missing,
manifest/file keys diverge, `any` mode is omitted, or a branch resolver is bypassed.

### Phase 3 — user-backed Admin Management

- Add a paginated/searchable user picker endpoint or safely reuse an existing one.
- Exclude users with existing memberships or present them as reactivate/edit states;
  handle races with the unique partial index.
- Admin creation takes `userId`, role, status, and optional grants/denials. Derive
  identity/display fields from the linked User; eliminate manual admin identity entry.
- Do not mutate the selected user's business role.
- Remove legacy free-text admin creation UI.
- Remove every "promote to admin" button/action from user list/detail.
- Remove `admin` from user-role editing API/UI; a user can be both coach/seller/etc. and
  an Admin membership.
- Provide safe activate/revoke/reactivate flows and preserve history.

### Phase 4 — permission-aware UI and route guards

Create one client/server permission source derived from the same effective context.
Apply it to:

- admin layout and sidebar/nav groups;
- dashboard cards/shortcuts/badges/notification links;
- every page and nested page;
- tabs, filters exposing restricted concepts, create/edit/delete/status buttons,
  row menus, bulk actions, export actions, and empty-state CTAs;
- direct URL navigation with server-side guards (client hiding is not security).

Unauthorized modules must not appear as disabled placeholders or leave labels/gaps.
Filter arrays before render and let RTL flex/grid reflow naturally. Test desktop,
tablet, and mobile layouts. Avoid hydration flashes that briefly reveal unauthorized
items; permissions should be available at the correct server/layout boundary.

### Phase 5 — exhaustive permission registry reconciliation

Generate/maintain a machine-readable coverage matrix connecting:

`admin page -> visible actions -> API method/route -> permission key -> nav item`

Walk every file under `src/app/(Admin-Panel)/p-admin` and every in-scope API. Detect:

- stale keys/modules with no page/action/API (known example: warehouse);
- pages/actions without keys (known examples are only examples: discounts, coupons,
  installments and other financial pages);
- keys too broad for materially different actions;
- duplicate aliases/ambiguous legacy keys;
- mismatched nav, page, button, and API keys.

Add automated coverage checks so future pages/routes cannot silently bypass RBAC.
Permission labels/descriptions must be clear Persian and grouped exactly like the real
panel, including nested operations.

### Phase 6 — comprehensive admin activity audit

Design an append-only audit model/service and instrument admin behavior consistently.
At minimum capture:

- actor user/admin membership and role snapshot/effective permission context;
- request/action name, method, normalized route, resource type/id;
- success/failure/denied result and safe status/error category;
- timestamp, request/correlation ID, IP (respecting trusted proxy rules), user agent;
- safe structured metadata and redacted before/after diff for mutations.

Audit authorization denials and all meaningful admin mutations. Decide which reads,
exports, and sensitive detail views must also be logged to satisfy "every action" and
document the decision. Logging must not create a privilege bypass or break the primary
operation; establish explicit reliability semantics. Add indexes/retention/pagination
appropriate for timeline queries without making records mutable through ordinary API.

Build:

- `admins.viewActivity`-protected API with pagination, filters, sorting, and strict
  object ID validation;
- clickable admin detail page showing identity, status, role, effective permissions,
  accessible pages/capabilities, and activity timeline;
- readable Persian action labels and detailed drill-down while redacting secrets;
- tests proving an admin cannot view another admin's activity without permission and
  cannot tamper with audit records.

### Phase 7 — migration and cutover

- Finish a dry-run-first migration from the 8 legacy `User.role=admin` accounts to
  linked Admin memberships.
- Never guess ambiguous permissions. Produce a report requiring explicit resolution or
  map only unambiguous retired keys.
- Ensure a protected full-access role and at least one usable linked full-access admin
  exist before cutover.
- Define backup/rollback/idempotency and duplicate handling.
- After verified migration, remove the legacy full-access fallback and stop treating
  `User.role=admin` as panel authorization. Normalize legacy business roles only with a
  documented safe rule.
- Run migration in apply mode only with explicit user approval and correct environment.

### Phase 8 — final verification

Before declaring completion:

- scanner/coverage matrix: zero gaps;
- unit, API integration, concurrency, and authorization matrix tests;
- negative tests for every module/action (`401`, `403`, malformed inputs, escalation);
- full lint and production build;
- targeted regression tests for orders, payments, discounts, installments, content,
  support, users, coach flows, caching/revalidation, and mixed-use endpoints;
- UI test with at least full-access, read-only, module-scoped, and no-access admin
  personas across desktop/mobile;
- direct URL and direct API attempts for hidden capabilities;
- `git diff --check`, review all changed files, and explicitly list pre-existing
  unrelated failures separately.

Produce a final Persian report with implemented behavior, security guarantees, test
evidence, migration status, and any user action still required. Do not claim completion
while legacy fallback remains active or migration/verification is unresolved.

## 9. First prompt when Claude quota resets

Read this entire file and `AGENTS.md`, inspect the dirty diff, and resume **Section 6
only**. Complete the interrupted invariant/user-ban correction, add the real replica-set
concurrency tests, run all Batch-1 checks, perform an adversarial review, fix findings,
and stop with a Batch-1 acceptance report. Do not begin another phase in the same first
turn and do not run migration apply/commit/deploy.

---

## 10. Batch-1 correction round — COMPLETED (Section 6 + 7 closed)

Section 6 is finished and Section 7 is accepted. Everything below is working-tree only:
nothing committed, nothing deployed, migration never run with `--apply`.

### Evidence (actual command output, not claims)

| Command | Result |
|---|---|
| `node --test tests/adminRbac.test.mjs` | 99 tests / 99 pass / 0 fail |
| `npm run test:admin-rbac-tx` (real `MongoMemoryReplSet`) | 24 tests / 24 pass / 0 fail |
| `npm run verify:admin-auth` | 136 admin handlers + 48 external, **166 violations — identical to the pre-Batch-1 baseline, zero Batch-1 residue** |
| `npx eslint <18 changed Batch-1 files>` | no output (clean) |
| `git diff --check` | clean |
| `npm run build` (Next 16 + TypeScript) | exit 0 — relative `.js` imports in the invariant helper load in both Node tests and the Next build |

### Finding A — closed, but the handoff's stated mechanism was partly wrong

Fixed as specified: sentinel located by `systemKey` **+** `isSystem:true` **+**
`isFullAccess:true`, `$inc: { invariantRevision: 1 }` inside the transaction,
`matchedCount !== 1` fails closed, a second `isFullAccess` role fails closed,
count before/after in the same session, transactions required or fail closed.

**Correction, verified by experiment:** reverting to the old `$set:
{ invariantTouchedAt }` did **not** break the concurrency tests. `updateMany` reported
`{matchedCount:1, modifiedCount:1}` while the field was absent from the stored
document — Mongoose's `timestamps: true` plugin injects its own `updatedAt` `$set` into
the same update, so a real write on the sentinel still happened and accidentally
serialized the transactions. The fix is still correct (explicit, schema-declared
serialization instead of an undeclared side effect that any schema change could remove),
but the original diagnosis "no write conflict was created" was inaccurate.
`tests/adminRbacTransactions.test.mjs` now asserts the counter actually increments
`0 → 1 → 2`.

**Invariant rule is `after === 0 && before > 0`, not `after === 0`.** Production
currently has 0 linked memberships (8 legacy `User.role === "admin"`), so the strict rule
would 409 every admin-management and user-ban request. `0 → ≥1` is free, `≥1 → 0` is
forbidden, so the invariant becomes permanent the moment the first usable super exists.

### Finding B — closed

Every `isBanned` mutation now goes through the protected transaction with 409/503
mapping; strict boolean/number validation (`validateUserPatchPayload`); malformed
`userId`/`coach` → controlled 404/422; `role:"admin"` denied at two layers.
**Self-ban decision:** `isBanned: true` on your own account is 403; self-unban is
harmless and allowed.

### Additional findings from the adversarial review (all fixed)

1. **Retry-unsafe protected saves (the most serious).** Both `admins/[id]` PUT and
   `users/[userId]` PATCH passed `(session) => doc.save({ session })` where `doc` had
   been mutated *outside* the transaction. `withTransaction` re-runs the whole callback
   on a transient error, but a saved Mongoose document is clean — the second run writes
   nothing (silent write loss on `User`), and with `optimisticConcurrency` on `Admin` the
   stale in-memory `__v` turns it into a spurious `VersionError` → 409. Replaced by
   `saveWithSuperAdminInvariant(doc)`, which captures the delta once and re-reads +
   re-applies it inside every attempt, with an explicit version check
   (`ConcurrentModificationError` → 409). Proven by four replica-set tests, including a
   deterministically forced `WriteConflict` retry.
2. **`.trim()` on non-string body fields** → `TypeError` → 500 in `admins` POST/PUT and
   both roles handlers. Now a shared `validateOptionalText()` → 422.
3. **ReDoS / pattern injection** in role-name duplicate checks (`new RegExp(\`^${name}$\`,"i")`)
   → native `.collation({ locale:"en", strength:2 })`.
4. **Missing `isValidObjectId` in `roles/[id]`** PUT and DELETE → CastError → 500; now 404.
5. **Scope *widening* in the notification read filter**: dropping a malformed `ids`/ref
   turned "these two notifications" into "all allowed notifications". Now returns a
   match-nothing filter.
6. **Silently dropped permission fields** in `admins/[id]` PUT: the gate demanded
   `admins.managePermissions`, returned 200, and changed nothing because only
   `body.permissions` was read. `permissionGrants`/`permissionDenials` are now applied;
   sending both `permissions` and `permissionGrants` is 422.

### Known limitation (documented, not fixed)

The end-to-end "old pattern loses the write" case needs a transient error at **commit**
time, which cannot be forced in-process. It is covered by two deterministic tests
instead: the Mongoose mechanism itself (a clean document's second `save()` writes
nothing) and a replayed "successful attempt → rollback → re-run" sequence.

### Not done, deliberately

Migration `--apply`, commit, deploy. The legacy `User.role === "admin"` path is
still open by design — see Section 5.

---

## 11. Phase 2 — Batch 2 of 5 (catalog & storefront) COMPLETE

Scanner violations: **166 → 124**. 43 handlers converted; no Batch-1 route regressed.

### Routes converted

| Group | Handlers |
|---|---|
| `/admin/variants` | GET → `variants.view` |
| `/admin/home-sliders` | GET → `homeProductSliders.view`, PUT → `homeProductSliders.edit` |
| `/admin/home-roland-garros` | GET → `homeRolandGarros.view`, PUT → `homeRolandGarros.edit` |
| sports | create/edit/delete/reorder |
| categories | create/edit/delete/reorder |
| brands | create/edit/delete/reorder |
| series | create/edit/delete + reorder→`series.edit` |
| limited editions | create/edit/delete |
| products | create, reorder→`products.edit`, edit, delete, `[productId]/price` DELETE |
| variants | `[productId]/variants` GET/POST, `/variants/[variantId]` DELETE |
| athletes | create/edit/delete |
| banners / slides | all mutations → `homeBanners.edit` / `homeSlider.edit` |

### Vulnerabilities closed (not just "gate swapped")

1. **`DELETE /api/product/[productId]/price` deleted the whole product** — despite its
   path it is a copy of the product-delete handler (`Product.findByIdAndDelete` plus
   `Variant.deleteMany`), it had **no caller anywhere in the codebase**, and its only
   check was "is anyone logged in". Any customer account could delete any product.
   Keyed on what it actually does: manifest changed `products.edit` → **`products.delete`**,
   with a test that fails if someone re-keys it from the path name.
2. **`PUT` / `DELETE /api/product/[productId]`** had the same "any logged-in user" check
   → now `products.edit` / `products.delete`.
3. **`GET /api/banners?admin=true`** and **`GET /api/product?isAdmin=true`** drop the
   `isActive` filter and return unpublished content. Banners had **no check at all**;
   products had the legacy `requireAdmin`. Both now require a key **only in admin mode** —
   the public storefront path is byte-for-byte unchanged.
4. Everything under sports / categories / brands / series / limited-editions / athletes /
   slides was fully **unauthenticated** create/edit/delete.

### Evidence

| Check | Result |
|---|---|
| `node --test tests/adminRbac.test.mjs` | 104 / 104 pass (was 99; 5 new Phase-2 tests) |
| `npm run test:admin-rbac-tx` | 24 / 24 pass |
| `npm run verify:admin-auth` | **124** violations (from 166), zero converted-route residue |
| `npx eslint <31 changed files>` | clean |
| `npm run build` | exit 0 |
| `git diff --check` | clean |

New regression test `no already-converted route appears in the scanner output` runs the
real scanner and fails if any Batch-1/Batch-2 route loses its gate, diverges from the
manifest, or if the total violation count rises above 124. Raise that ceiling only
downward as later batches land.

### Known, deliberately not changed

- `GET /api/product/[productId]` still shows a deactivated product to *any* logged-in
  user (`getUserFromToken`). It is a public storefront route, not in the manifest, and
  the admin edit page reads it; belongs to a storefront-visibility pass, not this batch.
- `PUT /api/banners/[id]` does `$set: body` with no field whitelist. Mongoose `strict`
  drops unknown paths, so it is contained, but it is still mass-assignment behind an
  admin key.

---

## 12. Phase 2 — Batch 3 of 5 (orders, payments, financial) COMPLETE

Scanner violations: **124 → 75**. 49 handlers converted; no earlier route regressed.

### Routes converted

orders (list, detail, `changeStatus`) · order items (POST/PATCH/DELETE → `orders.editItems`) ·
management discount (`orders.adjustDiscount`) · EUR pricing/payments, all four methods
(`orders.setCurrency`) · order tracking (`orderTracking.view` / `.assign`) ·
tracking-items lookup · used-product tracking · payments approve / reject / edit
(three distinct keys) · discounts, coupons, quantity-discounts (view/create/edit/delete) ·
exchange rate (view/edit) · installments, installment balance, confirm-order
(`installments.approveCheck`) · analytics · order flows (view/create/edit/delete) ·
**site-settings (the branch route)**.

### Notable work beyond swapping the gate

1. **`/admin/site-settings` is the first converted BRANCH route.** One key-value endpoint
   with five different owners: without per-key resolution, `reviewCredit.view` also read
   the **bank account details**. Now wired to `resolveSiteSettingPermission(key, action)`
   under the full scanner contract — identity gate first (401 vs 403), then resolver,
   then `if (!resolved.allowed) return forbidden()`, then the keyed gate. Unknown or
   missing keys fail closed. A test asserts the ordering directly, and a second test
   scans the admin UI for the `?key=` values it actually requests and fails if any of
   them lacks an owner.
2. **Double admin lookup removed.** Nine order/payment handlers ran `requireAdmin()`
   twice per request — once to gate, once through a `getAdminUser()` wrapper to get
   `admin.userId` for `reviewedBy` / `confirmedBy` / `addedById`. All now take `actor`
   from the gate itself: one DB round-trip instead of two, identical audit data. A test
   asserts each of those files still writes `admin.userId` **and** sources it from the
   gate, so nobody can quietly break the audit trail.
3. **Dead auth code deleted** in `/admin/discounts` (`const admin = getAdminFromRequest(req)`
   — never awaited, never used, plus an unused `jsonwebtoken` import).
4. **`PUT /admin/site-settings` now rejects a malformed body with 400** instead of
   throwing into the generic 500 handler.

### Evidence

| Check | Result |
|---|---|
| `node --test tests/adminRbac.test.mjs` | 108 / 108 pass (was 104; 4 new) |
| `npm run test:admin-rbac-tx` | 24 / 24 pass |
| `npm run verify:admin-auth` | **75** violations (from 124), zero converted-route residue |
| `npx eslint <27 changed files>` | clean |
| `npm run build` | exit 0 |
| `git diff --check` | clean |

The regression guard's ceiling moved 124 → 75.

### Behaviour changes worth knowing

- `GET /admin/site-settings` with a missing or unknown `key` now returns **403**, not
  400. Required by the branch contract (never reveal which keys exist); all five keys the
  admin UI uses are covered.

---

## 13. Phase 2 — Batch 4 of 5 (content, campaigns, people, support) COMPLETE

Scanner violations: **75 → 11**. 64 handlers converted.

### Milestone: `/api/admin` is fully enforced

All **136 handlers in 82 files** under `/api/admin` now go through
`requireAdminPermission`. Every one of the 11 remaining violations is a route
**outside** `/api/admin` (`/bans`, `/otps`, `/navbar`, `/ai/*`) — Batch 5.

A new test walks the whole `src/app/api/admin` tree and fails if any `route.js`
imports the legacy gate or fails to import the new one. From here, a new admin file
without a gate is a **regression**, not remaining debt.

### Routes converted

articles (list/detail/create/edit/delete/revisions) · article CMS (list, entities,
autosave, duplicate, restore, revision view/restore) · article categories and tags ·
CMS pages · events/campaigns (list, detail, create, edit, delete, publish, duplicate,
products-preview, attribute-options, preview-products) · dashboard stats · coaches
(list, orders, wallet) · coach applications + review · coach credits · comments ·
contact messages · tickets (list, stats, detail, close, reply) · used products ·
health cards.

### Notable work beyond swapping the gate

1. **The article family answered 401 for everything.** All 13 article/CMS/taxonomy
   files used `unauthorizedResponse()` — an authenticated admin lacking the permission
   got "Unauthorized" instead of "Forbidden". The gate now makes that distinction, and
   a test asserts the helper is gone from those files.
2. **Author/editor attribution preserved.** Nine content handlers write `admin._id`
   into `author` / `createdBy` / `updatedBy` / revision `createdBy`. Each now takes
   `actor` from the gate; a test asserts that any file using `admin._id` also sources
   it from the gate.
3. **Four more double-lookup wrappers deleted** (`coaches/[coachId]/orders`,
   `coaches/[coachId]/wallet`, `used-products/[id]`) plus two more copies of the dead
   `getAdminFromRequest(req)` + unused `jsonwebtoken` import in `coach-credits`.
4. **Operation-specific keys, not one coarse module key**: autosave is `articles.edit`
   (it is a full write), duplicate is `articles.create` (it makes a new article),
   campaign publish is its own `collections.publish`, ticket reply is separate from
   ticket close, coach wallet top-up is `coaches.manageCredits` rather than
   `coaches.view`. Three tests pin these apart.

### Evidence

| Check | Result |
|---|---|
| `node --test tests/adminRbac.test.mjs` | 112 / 112 pass (was 108; 4 new) |
| `npm run test:admin-rbac-tx` | 24 / 24 pass |
| `npm run verify:admin-auth` | **11** violations (from 75), all outside `/api/admin` |
| `npx eslint "src/app/api/admin/**/*.js"` | clean (whole tree) |
| `npm run build` | exit 0 |
| `git diff --check` | clean |

The regression guard's ceiling moved 75 → 11, and it now also asserts that **no**
remaining violation is under `/api/admin`.

---

## 14. Phase 2 — Batch 5 of 5 COMPLETE. **Phase 2 is done: scanner at zero.**

```
بررسی ایستا: 136 هندلر در 82 فایل زیر /api/admin + 50 هندلرِ ادمینیِ بیرونی
✓ هر هندلر دقیقاً همان کلیدِ manifest را اعمال می‌کند.
✓ همه‌ی روت‌های داخلِ دامنه گیت دارند.
exit 0
```

**186 handlers**, every one gated with exactly the manifest's key. Scanner
**166 → 124 → 75 → 11 → 0**.

### Routes converted (13 handlers — the manifest grew by 2, see below)

`/bans` GET+POST, `/bans/[id]` GET+PUT+DELETE, `/otps` GET+POST,
`/otps/[id]` GET+PUT+DELETE, `/navbar` POST, `/ai/product-draft`, `/ai/athlete-prompt`.

### Notable work beyond swapping the gate

1. **Two manifest gaps closed.** `/bans/[id]` and `/otps/[id]` listed `PUT`/`DELETE`
   but not `GET` — while the *collection* `GET` was listed. The detail `GET` returns
   the same data (a ban with `user`/`bannedBy` populated; a single OTP code), so the
   split was a real hole. Both now require the same key, and a test pins the method set.
2. **Forgeable audit trail in `/bans`.** `bannedBy` was read from the request body:
   any caller could record a ban under another admin's name — on a route that had
   **no authentication at all**. It now always comes from the gate's `actor`.
3. **`/bans/[id]` and `/otps/[id]` were broken, not merely unguarded.** All six
   handlers did `const { id } = params` — in Next 16 `params` is a Promise, so `id`
   was `undefined` and every call failed. Gating a handler that cannot work is
   security theatre, so the `await` was fixed in the same change. A test asserts all
   six await it.
4. **`/navbar` POST** was an unauthenticated cache-invalidation lever: any visitor
   could repeatedly dump the navbar cache. `GET` stays public (the storefront reads
   it) and a test asserts that split stays intact.

### Evidence

| Check | Result |
|---|---|
| `node --test tests/adminRbac.test.mjs` | 116 / 116 pass (was 112; 4 new) |
| `npm run test:admin-rbac-tx` | 24 / 24 pass |
| `npm run verify:admin-auth` | **0 violations, exit 0** |
| `npx eslint` (batch files + whole `/api/admin` tree earlier) | clean |
| `npm run build` | exit 0 |
| `git diff --check` | clean |

The regression guard is now absolute: `the admin-auth scanner reports zero violations`
asserts an empty violation list *and* exit code 0, so any new ungated admin handler
fails the test suite. The per-batch route list it used to carry was deleted — the
manifest plus the scanner is the single source of truth.

### ⚠️ Still open: `/api/otps` should be deleted, not gated

`GET` returns every one-time code in the database; `POST` mints a code for any phone
number. Either is a full account-takeover primitive. It has **no caller anywhere in
the codebase** and no legitimate admin capability corresponds to it, which is why no
permission key was invented for it — all four methods sit behind
`admins.managePermissions` purely to put it out of reach. Deleting the route is the
correct fix and needs an explicit decision; the recommendation is recorded in
`src/app/api/otps/route.js` and asserted by a test so it cannot be quietly dropped.

### What Phase 2 does *not* yet give you

Enforcement is real, but the **legacy fallback is still open**: the 8 accounts with
`User.role === "admin"` and no `Admin` membership resolve to the full key set (see
Section 5). Fine-grained enforcement only becomes real for them after Phase 7's
migration. Everything gated in Phase 2 is nevertheless now closed to anonymous and
non-admin callers, which it was not before.

---

## 15. Phase 3 — user-backed Admin Management COMPLETE

An "admin" is now a **membership of a real `User`**, not a free-text identity.

### API

| Change | Detail |
|---|---|
| **New** `GET /api/admin/admins/candidates` | Paginated, searchable user picker. Gated on **`admins.create`**, not `users.view` — creating an admin must not require the right to browse the whole user base. Returns each user's `membership` state plus a server-decided `blockedReason` (`banned` / `already-member`), so UI and API share one rule. Search input is escaped before `new RegExp` (no ReDoS), hard `limit` cap of 50, real `skip`/`countDocuments` pagination. |
| `POST /api/admin/admins` | Now takes **`userId`**. 422 without a valid one, 404 if the user is gone, 422 if the user is banned (a banned user's membership is dead on arrival — `resolveAdminContext` rejects it). Identity is derived: `name` from `deriveDisplayName(user)`, `username` from `deriveUsername(user, taken)`, `email` from the user's profile. Only `title` stays free text. **Never touches `user.role`.** |
| Duplicate membership | Optimistic check returns 409 **with `adminId`** so the UI can jump to edit/reactivate. The real race is caught by the partial unique index `admin_user_unique` → same 409, distinguished via `error.keyPattern.user`, never a 500. |
| `PUT /api/admin/admins/[id]` | `name` / `username` / `email` removed from `ADMIN_EDIT_FIELDS`, so sending them is now an **unknown field → fail-closed 403**. The username-uniqueness block is gone. On every PUT of a linked membership the display name and email are **re-derived from the user**, so the list cannot go stale after a rename. |
| `GET` list + detail | Now populate `user` (name, phone, email, avatar, isBanned). |

### Shared helpers

`deriveDisplayName` and `deriveUsername` moved from `scripts/auditAdminRbac.mjs` into
`src/lib/adminGuards.js`; the script re-exports them. The migration and the create route
now produce **identical** identities — previously the same logic existed only in the
script, so an admin created through the UI and one created by the migration would have
looked different. The re-export keeps the script's public surface (and its tests)
unchanged, and `npm run audit:admin-rbac` still emits the same `admin-XXXXXXXX` names.

`deriveUsername` is built from the user's `_id`, deliberately: stable across renames,
always matches `^[a-z0-9_.-]{3,30}$`, and carries no personal data.

### UI

- **New** `src/components/admin/admins/UserPicker.jsx` — debounced search, paginated,
  SWR-backed. Users who already have a membership are **not hidden**; they are shown
  with their state and a direct link to *edit* / *reactivate*, so the operator never
  sees a misleading "not found".
- `AdminForm` — free-text name/username/email inputs **deleted**. Create mode shows the
  picker; edit mode shows the linked user read-only (a membership's user never changes —
  make a new membership for a different person) plus the derived username/email as
  read-only fields. The submit payload is now explicit instead of `{...formData}`, so no
  field the server rejects can be sent by accident. A 409 with `adminId` redirects to
  that membership instead of just showing an error.
- Admins list — surfaces the linked user, and flags `user: null` legacy rows as
  **"بدون کاربرِ متصل — غیرقابل استفاده"**: such a document maps to no session, so it
  looked like an active admin while being inert.
- User detail — the **"مدیر کل" option is gone** from the business-role dropdown.
  There was no separate "promote to admin" button anywhere (verified by search); that
  dropdown was the only path, and the API already rejected `role: "admin"` — this
  removes the second layer.

### Activate / revoke / reactivate

Already delivered in Batch 1 and unchanged: `PUT isActive` and `DELETE` (soft revoke)
record `revokedAt`/`revokedBy`/`revokeReason`, are idempotent, never overwrite an earlier
revocation, never hard-delete, and run inside the super-admin invariant transaction.

### Evidence

| Check | Result |
|---|---|
| `node --test tests/adminRbac.test.mjs` | 123 / 123 pass (was 116; 7 new, 1 existing test updated for the new field set) |
| `npm run test:admin-rbac-tx` | 24 / 24 pass |
| `npm run verify:admin-auth` | 0 violations, exit 0 (now 137 admin handlers in 83 files) |
| `npm run audit:admin-rbac` (read-only) | runs clean; derived usernames unchanged after the helper move |
| `npx eslint` on all Phase-3 files | clean |
| `npm run build` | exit 0 |
| `git diff --check` | clean |

Note: `users/[userId]/page.jsx` has one **pre-existing** `react-hooks/set-state-in-effect`
error at line 109, present before this change (verified by stashing). Not introduced here
and not in scope.

### Known / deliberate

- The users list still has a `مدیران` **filter** on `User.role === "admin"`. It is a
  filter, not a promotion path, and it stays useful until the Phase 7 migration clears
  the legacy role.
- Existing memberships with `user: null` are still tolerated by the API (they only get
  flagged in the UI). Nothing *creates* them any more; Phase 7 decides their fate.
- `npm run audit:admin-rbac` still reports the migration as **blocked**: one role
  («مدیر محصولات») carries 6 ambiguous legacy keys (`events.*`, `finance.*`) that need a
  human decision. That is Phase 7's gate, unchanged by this phase.

### Next

Phase 4 — permission-aware UI and route guards (Section 8).


---

## 16. Phase 4 — Batch 1 of N: shared permission source, navigation guard, chrome

**Scope of this batch:** one permission source shared by server and client, the
server-side guard for direct *and* soft URL navigation, the admin layout /
sidebar / header, the dashboard, and the three multi-tab hub pages. Per-page
action controls (create/edit/delete buttons, row menus, bulk and export
actions, filters, empty-state CTAs) across the remaining ~78 pages are **not**
in this batch — see "Still open" below.

### The one source

`src/lib/permissions.js` was already the registry. Phase 4 adds no parallel
copy: both layers call the same `canAccessAdminRoute` / `hasPermission`.

```
resolveAdminContext()  ──┬── middleware (nodejs runtime)  → canAccessAdminRoute → rewrite
                         └── p-admin/layout.jsx (server)  → AdminPermissionProvider
                                                              └── useAdminPermissions()
                                                                  { can, canRoute, admin }
```

Permissions are resolved **on the server, in the layout**, and passed down as a
prop. No client fetch, so the first painted HTML is already correct — there is
no "render then hide" flash.

### Why middleware, not the layout

A guard in `p-admin/layout.jsx` alone is **not** sufficient. On soft navigation
Next.js re-renders only the changed page segment; the layout is reused and does
not run. A server-component page under a stale layout would therefore render
and stream its data with no gate. `middleware` runs on every request — full
page load, RSC navigation, and prefetch — so it is the only real choke point.

Verified at runtime, not assumed (production build, `next start`, real tokens):

| request | result |
|---|---|
| no cookie → `/p-admin` | 307 → `/login-register?callbackUrl=%2Fp-admin` |
| invalid token → `/p-admin` | 403 notice, **no** panel chrome |
| plain `role: "user"` → every p-admin path | "not-admin" notice, no chrome, `/api/admin/stats` 403 |
| real admin → `/p-admin`, products, support?tab=comments, financial, users/admins | 200 with chrome |
| real admin → `/p-admin/nope` | rewritten to the 403 notice, chrome kept |
| **`RSC: 1` → `/p-admin/nope`** | **denied** — soft navigation is gated too |
| `RSC: 1` → `/p-admin/admin-products` (allowed) | passes through |

The `runtime: "nodejs"` middleware queries mongoose. Confirmed working in a
production build; it costs one extra context resolution per admin navigation
(the layout does its own). Acceptable for an admin panel; it is the price of
the guard being real.

### Changes

| File | Change |
|---|---|
| `src/lib/adminContext.js` | `resolveAdminContext({ token })` accepts an explicit token; `next/headers` moved to a **dynamic** import (a static one makes the module unloadable in middleware) |
| `src/middleware.js` | rewritten: legacy `payload.role !== "admin"` JWT check **deleted**, replaced by `getAdminContext({ token })` + `canAccessAdminRoute(ctx.permissions, pathname + search)` |
| `src/app/(Admin-Panel)/p-admin/403/page.jsx` | NEW — rewrite target; deliberately absent from `ADMIN_ROUTE_PERMISSIONS` |
| `src/components/admin/ForbiddenNotice.jsx` | NEW — one notice used by both the 403 page and the client guard |
| `src/components/admin/AdminPermissionProvider.jsx` | NEW — `useAdminPermissions()` → `{ can, canRoute, permissions, isFullAccess, admin }`; outside the provider everything is `false` |
| `p-admin/layout.jsx` | now `async`; resolves the context, feeds the provider, and renders a bare shell (no sidebar/bell) for a non-admin session |
| `components/admin/Layout.jsx` | sidebar filtered with `canRoute`; breadcrumb reads the filtered list; header shows the real admin name/title; client route guard for soft navigation |
| `p-admin/page.jsx` | dashboard hero cards and shortcut array filtered; greeting uses the real name |
| `p-admin/support/page.jsx` | tabs filtered via `ADMIN_TAB_PERMISSIONS`; default tab is the first **allowed** one |
| `p-admin/admin-pages/page.jsx` | same, plus `HOME_SECTIONS` filtered by route; `tab === "home" ? A : B` replaced with explicit equality |
| `p-admin/financial/page.jsx` | tabs carry explicit module keys (`bankAccount.view`, …), external link chips filtered by route |

### Bugs this batch closed

1. **Membership admins were locked out of the whole panel.** The old middleware
   demanded `payload.role === "admin"` from the JWT. After Phase 3 an admin is a
   `User` + an `Admin` membership; their `User.role` is *not* `"admin"`. Every
   admin created by the new flow would have been rewritten to a 404 before the
   migration even ran. This would have surfaced only at cutover.
2. **No page-level authorization existed at all.** Any user whose JWT said
   `role: "admin"` reached every page; permissions were enforced only by the
   APIs, so restricted pages rendered their shell and their server-side data.
3. **Wrong default tab.** `/p-admin/support` opened on *tickets* and
   `/p-admin/admin-pages` on *home* regardless of permission, and
   `admin-pages` used `tab === "home" ? Home : Pages` — an `else` branch, so any
   non-`home` value (including none) rendered the content-pages list.
4. **Dead greeting/identity.** The header and dashboard hardcoded "مدیریت" and
   an `ui-avatars` "Admin" image; they now show the signed-in admin.

### Checks (all run, output captured)

```
node --test tests/adminRbac.test.mjs               137 pass / 0 fail   (was 123)
node --test tests/adminRbacTransactions.test.mjs    24 pass / 0 fail
npm run verify:admin-auth                            0 violations, exit 0
npx next build                                       ✓ compiled, exit 0
eslint (8 changed/new files)                         no new findings
git diff --check                                     clean
```

Two pre-existing eslint errors were confirmed pre-existing by linting the
`HEAD` version of the same files side by side:
`components/admin/Layout.jsx` (2× `react-hooks/set-state-in-effect`) and
`p-admin/page.jsx` (`Cannot access variable before it is declared`, the
`fetchStats` hoist). Neither was introduced here; neither was "fixed" to make
output green.

One Phase-1 test was **removed**, not weakened:
`every real p-admin page has an explicit permission mapping` asserted a
hardcoded count of 81 pages. It is replaced by
`every admin page has a manifest entry and every entry has a page`, which
performs the same two-way diff, excludes the intentionally unmapped `/p-admin/403`,
and does not break every time a page is legitimately added.

### Still open — Phase 4 continues

- **Per-page controls.** Create/edit/delete buttons, status toggles, row menus,
  bulk actions, export actions, filters that expose restricted concepts, and
  empty-state CTAs across the remaining pages. This is the bulk of the phase and
  needs its own batches, one module group at a time.
- **Limited-role runtime proof.** Every runtime check above used a *legacy*
  admin (`admins` collection is still empty: `ADMIN_MEMBERSHIPS = 0`), who
  resolves to all keys. The limited path is covered by unit tests
  (`a limited role sees only its own sidebar entries`) but has **not** been
  exercised against a live server, because doing so means writing an `Admin`
  document into the production database — out of bounds until the migration is
  authorised. Do this immediately after the migration dry-run is accepted.
- **`تحلیل بازدیدها` chart and the "اعلان سیستم" card on the dashboard are
  fabricated data** (hardcoded bars, "۳ محصول در صف"). Not a permission issue,
  but they are lying to whoever reads the dashboard.
- **The sidebar logout button has no handler** — it renders and does nothing.
- Carried over from earlier phases and still unfixed: raw `$regex` from user
  input in `GET /api/admin/users`; `/api/otps` gated but should be deleted;
  `GET /api/product/[productId]` shows deactivated products to any logged-in
  user; `PUT /api/banners/[id]` does `$set: body` with no whitelist; the legacy
  `User.role === "admin"` path stays open until Phase 7; the migration is still
  **blocked** by 6 ambiguous keys on «مدیر محصولات».

---

## 17. Phase 4 — Batch 2 of N: catalog action controls

**Scope:** every create / edit / delete / reorder control in the catalog module
group — sports, categories, athletes-within-a-sport, brands, series, limited
editions, products, variants. Batch 1's route guard already decides *which
pages* open; this batch decides *which buttons exist on them*.

No new mechanism was introduced. Every control reads `can()` / `canRoute()`
from the Batch-1 `useAdminPermissions()` provider — the same effective
permission array the middleware guards with.

### Where the gates went

| File | Gated |
|---|---|
| `p-admin/admin-sports/page.jsx` | add CTA, drag-reorder |
| `components/templates/sports/SortableSportCard.jsx` | card click-through, edit, delete, drag handle, "قهرمانان" link |
| `p-admin/admin-sports/[sportId]/page.jsx` | edit-sport, add-category, drag-reorder |
| `p-admin/admin-sports/[sportId]/athletes/page.jsx` | add / edit / delete athlete |
| `p-admin/admin-brands/page.jsx` | add CTA, drag-reorder |
| `components/admin/SortableBrandCard.jsx` | logo link, edit, delete, drag handle |
| `components/admin/SortableCategoryCard.jsx` | card click-through, edit, delete, drag handle |
| `components/admin/BrandAdminPage.jsx` | edit/delete brand, create series, series-card row (products/edit/delete), series reorder, limited-edition create/edit/delete |
| `components/admin/SerieAdminPage.jsx` | create sub-series (header + empty-state CTA), child-card row, reorder |
| `components/admin/SerieProductsClient.jsx` | product reorder + the drag hint that advertises it |
| `components/admin/CategoryProductsClient.js` | add product (header + empty-state CTA), edit/delete category |
| `components/admin/ProductCard.jsx` | product edit + delete — **one gate, three lists** |
| `p-admin/admin-products/page.jsx` | add CTA (header + empty-state) |
| `p-admin/admin-products/[productId]/variants/page.jsx` | add + delete variant |

Rules followed throughout:

- **Arrays filtered, rows removed.** No disabled placeholders. When every action
  in a row is denied, the whole row — including its `border-t` separator — is
  dropped so nothing leaves a gap. Grid/flex reflow handles the rest.
- **Whole-card click-through is a permission too.** Cards that navigate on click
  (`sport`, `category`, `brand` logo) lose both the handler and the
  `cursor-pointer` when the destination route is denied — checked with
  `canRoute`, so it stays consistent with what the middleware will do.
- **Reorder is gated twice.** The drag handle is not rendered *and* `onDragEnd`
  is set to `undefined`. Either alone would work; both means a stray sensor
  can't fire a reorder PUT.
- `variants` has only `view`/`edit` in the registry, so adding and deleting a
  variant are both gated on `variants.edit` — not invented `variants.create` /
  `variants.delete` keys.
- `DataTable` already omits its action column when `onEdit`/`onDelete` are
  undefined, so the variants table loses the column header too.

### One real bug fixed in passing

`SortableBrandCard` linked to `` `admin-brands/${brand._id}` `` — a **relative**
href. From `/p-admin/admin-brands` it resolved correctly by luck; from any
deeper path it produced a wrong URL. It is now absolute, which is also what
makes `canRoute` able to judge it.

### A near-miss worth recording

Two files (`admin-sports/[sportId]/page.jsx`, `SortableCategoryCard.jsx`) were
patched by a script that matched on `\n` against **CRLF** files. Multi-line
replacements silently no-op'd while single-line ones applied — leaving
`[sportId]/page.jsx` calling `can(...)` with no `useAdminPermissions()` in
scope. **`next build` compiled it clean**; it would have thrown
`ReferenceError: can is not defined` in the browser on first render.

That is now a test, not a memory:
`a file that calls can()/canRoute() actually pulls them from the provider`
scans all of `src/app` + `src/components` and fails if any file uses a gate
without the hook.

### Tests added (5)

| Test | Guards against |
|---|---|
| `every UI permission gate uses a key that exists in the registry` | typo keys that silently evaluate false and hide a control forever |
| `a file that calls can()/canRoute() actually pulls them from the provider` | the CRLF near-miss above |
| `catalog create/edit/delete controls are gated on their own module keys` | a control losing its gate in a refactor |
| `the shared product card is the single gate for product row actions` | a consumer growing a parallel gate |
| `drag-to-reorder is disabled without the reorder permission` | reorder slipping through the handle-only gate |

### Checks (all run, output captured)

```
node --test tests/adminRbac.test.mjs               142 pass / 0 fail   (was 137)
node --test tests/adminRbacTransactions.test.mjs    24 pass / 0 fail
npm run verify:admin-auth                            0 violations, exit 0
npx next build                                       ✓ compiled, exit 0
eslint --quiet (all 14 changed files + their dirs)   no new errors
git diff --check                                     clean
```

The 18 remaining eslint errors in those directories are all in files this batch
did not touch (`admin-categories/add`, `admin-categories/edit/[categoryId]`,
`admin-products/edit/[productId]`, `admin-products/[productId]/variants/add`,
`admin-sports/edit/[sportId]`). The one in a file this batch *did* touch —
`variants/page.jsx` "Cannot access variable before it is declared" — was
verified pre-existing by stashing the change and re-linting.

### Runtime check (production build, real admin token)

| page | result |
|---|---|
| `/p-admin/admin-sports` | 200, "افزودن ورزش" present |
| `/p-admin/admin-sports/<id>` | 200, "ویرایش ورزش" + "افزودن دسته" present |
| `/p-admin/admin-sports/<id>/athletes` | 200, "افزودن قهرمان" present |
| `/p-admin/admin-brands` | 200, "افزودن برند" present |
| `/p-admin/admin-products` | 200, "افزودن محصول" present |
| `/p-admin/admin-brands/<id>` | 200 — **actions not in SSR HTML** |

The last row is not a regression: `BrandAdminPage` does `if (loading) return
<AdminLoader />` and fetches through client-side SWR, so the server response is
the spinner. Its gates are covered by the JSX-level tests and the build, but
have **not** been observed rendering in a browser.

### Still open in Phase 4

- Remaining module groups: orders, financial/discounts, second-hand, content
  (articles / pages / home / events), people & support. Same pattern, one batch
  each.
- Limited-role runtime proof (unchanged from §16): the `admins` collection is
  still empty, so every live check runs as a legacy full-access admin. The
  deny paths are unit-tested only until the migration is authorised.
- `p-admin/admin-products/[productId]/variants/page.jsx` renders its own
  `<AdminLayout>` **inside** the panel layout — a second sidebar nested in the
  first. Pre-existing, cosmetic, not touched here.

---

## 18. Phase 4 — Batch 3 of N: orders, financial/discounts, second-hand

**Scope:** order detail and order flows, discounts/coupons/quantity-discounts/
coach-credits, financial settings, installments, analytics export, and the
second-hand + health-card lists.

The order module is where the registry's fine-grained keys finally get used.
Every control is wired to the **same key its own API route already enforces**
(`src/lib/apiPermissions.js`), never to a freshly invented one:

| control | key | route it mirrors |
|---|---|---|
| ویرایش وضعیت | `orders.changeStatus` | `PATCH /admin/orders/[orderId]` |
| افزودن آیتم / تعداد / حذف آیتم | `orders.editItems` | `/admin/orders/[orderId]/items` |
| تخفیف مدیریت (افزودن/ویرایش/حذف) | `orders.adjustDiscount` | `/admin/orders/[orderId]/discount` |
| قیمت و پرداختِ یورویی | `orders.setCurrency` | `/admin/orders/[orderId]/eur` |
| تأیید رسید | `payments.approve` | `/admin/payments/[id]/approve` |
| رد رسید | `payments.reject` | `/admin/payments/[id]/reject` |
| ویرایش مبلغ پرداخت | `payments.edit` | `/admin/payments/[id]/edit` |
| ثبت/حذف بارکد رهگیری | `orderTracking.assign` | `/admin/orders/[orderId]/tracking` |

A test asserts both halves of every row above, so a change to either side
breaks the build rather than drifting apart silently.

### Security finding — a Phase-2 escapee, now closed

**`PATCH /api/installments/checks/[checkId]/status`** is an admin-only mutation
that marks a cheque cleared or bounced — and, when the last cheque clears,
flips the whole order to `PAID`. It lives outside `/api/admin`, was not in the
manifest, and so the Phase-2 scanner never looked at it. Its only gate was:

```js
const auth = await getAuthUser();          // decodes the JWT, nothing else
if (!auth || auth.role !== "admin") { … }  // trusts the token's own claim
```

That is the exact anti-pattern Phase 2 removed everywhere else. Consequences
while it stood: an admin whose membership was revoked, or whose user account was
banned, could keep settling customers' instalments for the remaining life of a
**15-day** access token; and any legacy `User.role === "admin"` account could do
it regardless of assigned permissions.

Fixed: added to `PUBLIC_ADMIN_API_PERMISSIONS` as
`{ PATCH: "installments.edit" }`, switched to
`requireAdminPermission("installments.edit")`, and the audit field
`check.reviewedBy` now comes from the verified context (`ctx.userId`) instead of
the token payload. `verifyToken` and the local `getAuthUser` helper are gone
from the file. The scanner's external-handler count went 50 → 51 and still
reports zero violations.

I re-swept the rest of `/api/installments`: `GET /api/installments` is
user-scoped (a customer's own plans) and correctly not admin-gated.

### Other decisions worth recording

- **Coach credits are not a discount.** The «کردیت مربیان» tab in
  `DiscountManager` sits next to three discount tabs but its API is
  `/admin/coach-credits`, gated on `coaches.view` / `coaches.manageCredits`.
  The tab list now carries `view`/`create` keys per tab, is filtered before
  render, and the default tab is the first **allowed** one — so an admin with
  only `coaches.view` lands on coach credits instead of an empty discounts tab.
- **Toggling "active" is an edit.** Activate/deactivate on discount rules,
  coupons, quantity discounts and order flows all issue `PATCH`/`PUT` to the
  same route as editing, so they are gated on `*.edit`, not on a separate key.
- **Financial settings show why the save button is gone.** Bank account,
  exchange rate, financing and review-credit each replace their submit button
  with a one-line "you don't have edit access — these values are read-only"
  note. A silently missing button reads as a bug.
- **Export is its own key.** `/p-admin/financial/analytics` opens with
  `analytics.view`; the export menu needs `analytics.export`.
- **Variant of the "no gap" rule:** `TrackingItemBadge` and the toman
  `PaymentCard` already render their action only when the handler prop exists,
  so those receive `undefined` instead of growing a second gate.

### Files changed (17)

`src/lib/apiPermissions.js` · `src/app/api/installments/checks/[checkId]/status/route.js` ·
`orders/AdminOrderDetailClient.jsx` · `orderFlow/OrderFlowsClient.jsx` ·
`discounts/DiscountManager.jsx` · `discounts/DiscountRuleCard.jsx` ·
`discounts/QuantityDiscountCard.jsx` · `discounts/CouponCard.jsx` ·
`discounts/CoachCreditCard.jsx` · `analytics/AnalyticsDashboard.jsx` ·
`financial/InstallmentChecksPanel.jsx` · `financial/BankAccountManager.jsx` ·
`financial/ExchangeRateManager.jsx` · `financial/FinancingSettingsManager.jsx` ·
`financial/ReviewCreditSettingsManager.jsx` · `admin-secondHands/page.jsx` ·
`admin-secondHands/used-products/page.jsx` · `admin-secondHands/healthcards/page.jsx`

`AdminOrdersClient.jsx` was reviewed and **left alone**: its only row action
navigates to the order detail page, which already requires `orders.view` to
reach the list at all. There is no create, delete, bulk or export control on it.

### Tests added (9)

Order-detail key↔API parity · check-status route gating · installment
edit-vs-approve split · discount tab ownership · per-card discount gates ·
financial save-button gates + read-only note · analytics export key ·
second-hand/health-card CRUD gates · order-flow card gates.

A `readNormalized()` helper was added to the suite — several panel files are
CRLF and the source-matching assertions are written against `\n`.

### Checks (all run, output captured)

```
node --test tests/adminRbac.test.mjs               151 pass / 0 fail   (was 142)
node --test tests/adminRbacTransactions.test.mjs    24 pass / 0 fail
npm run verify:admin-auth                            0 violations, exit 0  (51 external handlers, was 50)
npx next build                                       ✓ compiled, exit 0
eslint --quiet on all touched dirs                   no new errors
```

Files still reporting eslint errors are either untouched by this batch
(`discounts/*Form.jsx`, `AdminOrdersClient.jsx`) or were verified pre-existing
by stashing and re-linting (`ExchangeRateManager.jsx`,
`AdminOrderDetailClient.jsx` — 3 errors, identical before and after).

One `next build` run failed on `/sitemap.xml` with
`queryTxt ETIMEOUT cluster0.prrj4.mongodb.net` — a local DNS blip against Atlas,
not a code fault. The immediately following run completed all 205 static pages
and exited 0.

### Runtime checks (production build, real admin token)

All nine batch-3 pages returned **200**, with their action labels present, no
false denials, and no read-only notice for a full-access admin:
orders, order-flows, discounts, financial, analytics, installments,
second-hand hub, used-products, health-cards.

**Fail-closed verified, not assumed.** I started a server with
`MONGODB_URI_TENADOR` pointed at an unreachable host. Every `/p-admin` request
returned **500 with a 21-byte body** — no chrome, no page, no data. The
middleware guard cannot resolve a context, so it throws, and Next serves
nothing. A database outage degrades to "no access", never to "open door".

### Still open in Phase 4

- Remaining module groups: content (articles / pages / home / events) and
  people & support (users, admins, coaches, notifications, tickets, comments).
- Limited-role runtime proof — unchanged from §16/§17. The `admins` collection
  is still empty, so every live check runs as a legacy full-access admin; deny
  paths are unit-tested only until the migration is authorised.
- `BrandAdminPage`-style client-fetch pages (order detail, analytics,
  installments) render a spinner server-side, so their gated controls are
  covered by tests and the build but have not been observed in a browser.

---

## 19. Phase 4 — Batch 4 of 5: content (articles, pages, home, collections)

**Scope:** article list/taxonomy/editor/preview, CMS pages, all five home-page
section managers, and the collections (events) list.

### A real access defect fixed: the article editor opened on `articles.view`

`/p-admin/admin-articles/[articleId]` renders `ArticleEditor` — the full
block editor — but `ADMIN_ROUTE_PERMISSIONS` mapped it to `articles.view`. An
admin with read-only article access could open the editor, change blocks, and
only discover the problem when the save returned 403. The route now requires
`articles.edit`; the read path is `/[articleId]/preview`, which keeps
`articles.view`. A test pins both, including the negative case for a
view-only role.

### Keys follow the API, again

| control | key | route it mirrors |
|---|---|---|
| مقاله جدید / کپی | `articles.create` | `POST /admin/articles`, `POST /article-cms/[id]/duplicate` |
| ویرایش / آرشیو / بازیابی | `articles.edit` | `PATCH /admin/articles/[id]`, `POST /article-cms/[id]/restore` |
| زباله‌دان | `articles.delete` | `DELETE /admin/articles/[id]` |
| افزودن/آرشیو دسته و برچسب | `articleTaxonomy.manage` | `/admin/article-categories`, `/admin/article-tags` |
| ذخیره‌ی هر بخش صفحه‌ی اصلی | `home*.edit` | `/admin/site-settings` via `SITE_SETTING_OWNERS`, `/admin/home-sliders`, `/admin/home-roland-garros` |
| بنر/اسلاید (ساخت، فعال‌سازی، حذف، ترتیب) | `homeBanners.edit` / `homeSlider.edit` | `/banners*`, `/slides*` |
| توقف / فعال‌سازی / بایگانی کالکشن | `collections.publish` | `PUT /admin/events/[id]/status` |
| کپی / حذف کالکشن | `collections.create` / `collections.delete` | `/admin/events/[id]/duplicate`, `DELETE /admin/events/[id]` |

`articleTaxonomy` has only `view`/`manage` in the registry, so create **and**
archive both gate on `manage` — no invented `articleTaxonomy.create`.

### Two patterns established this batch

1. **Server components use the server context, not the hook.** `ArticlePreview`
   is an async server component; `useAdminPermissions()` cannot run there. It
   now builds its own `canRoute` from `getAdminContext()` +
   `canAccessAdminRoute` — the same registry functions, different entry point.
   The batch-2 "every gate has a source" test was widened to accept this second
   form explicitly rather than being weakened.
2. **Editors deliberately carry no second gate.** `ArticleEditor`, `PageEditor`
   and `EventForm` are only reachable through routes that already demand
   `create`/`edit`, and their save button posts to the same key. Adding an inner
   gate would be duplicated logic that can drift. A test asserts the four route
   keys **and** that these three files contain no gate — so "no gate here" is
   recorded as a decision, not read later as an oversight.

Also: `ProductSliderManager`'s search box is the only way to add a product, so
it is gated too, and the empty-state text stops telling a read-only admin to
"add one with the search above".

### Files changed (12)

`src/lib/permissions.js` (route key) · `articles/ArticleList.jsx` ·
`articles/ArticleTaxonomies.jsx` · `articles/ArticlePreview.jsx` ·
`pages/PagesList.jsx` · `home/FeaturedArticlesManager.jsx` ·
`home/RolandGarrosBannerManager.jsx` · `home/ProductSliderManager.jsx` ·
`admin-home/banners/page.jsx` · `admin-home/slider/page.jsx` ·
`events/EventList.jsx` · `tests/adminRbac.test.mjs`

Reviewed and deliberately unchanged: `ArticleEditor`, `PageEditor`, `EventForm`,
`RevisionHistory` (lives inside an edit-gated page), and the events hub page
(its only link needs the same key as the hub itself).

### New: orphan permission keys are now tracked by a test

Phase 5 needs a list of registry keys nothing enforces. Rather than leave it as
prose, `permission keys that nothing enforces are tracked, not forgotten`
computes it — scanning `apiPermissions.js` for quoted keys, including those
reached only through branch resolvers such as `SITE_SETTING_OWNERS` — and
asserts it equals exactly:

| key | why it is orphaned |
|---|---|
| `admins.viewActivity` | Phase 6 will enforce it |
| `analytics.export` | the export is built entirely client-side from already-fetched data; **no API can enforce it**, so this gate is UI-only and cannot be treated as security |
| `articles.publish` | publishing goes through `PATCH` under `articles.edit` |
| `limitedEditions.view` | the list lives inside the brand page (`brands.view`) |
| `orders.edit` | superseded by the four fine-grained order keys |
| `pages.create`, `pages.delete` | the CMS has a fixed slug set — neither operation exists |
| `pages.publish` | a field inside the same `PUT`, not a separate route |

If someone wires one up or invents a new dead key, the test says so.

### Checks (all run, output captured)

```
node --test tests/adminRbac.test.mjs               160 pass / 0 fail   (was 151)
node --test tests/adminRbacTransactions.test.mjs    24 pass / 0 fail
npm run verify:admin-auth                            0 violations, exit 0
npx next build                                       ✓ compiled, 0 prerender errors
eslint --quiet on all four content dirs              1 error, in untouched PageEditor.jsx
```

The single eslint error is `PageEditor.jsx:51` (`set-state-in-effect`);
`git diff --stat` confirms this batch did not touch that file.

Two build runs failed on `/sitemap.xml` with `querySrv/queryTxt ETIMEOUT
cluster0.prrj4.mongodb.net`. This is the local resolver flaking against Atlas,
not a code fault — `nslookup` confirmed the records resolve, and a subsequent
build reported **0** prerender errors.

### Runtime checks (production build, real admin token, cold server)

All twelve batch-4 pages returned **200** with their action labels present, no
denials and no read-only notices for a full-access admin: article list,
taxonomy settings, new-article editor, both CMS-pages tabs, slider, banners,
product sliders, featured articles, roland-garros, events hub, campaigns list.

### Still open in Phase 4

- **Batch 5 (last):** people & support — users, admins, coaches
  (applications/credits/wallet), user notifications, tickets, comments, contact
  messages.
- Limited-role runtime proof still blocked on writing an `Admin` membership to
  the database (unchanged from §16–§18).

---

## 20. Phase 4 — Batch 5 of 5: people & support. **Phase 4 is complete.**

**Scope:** users list and detail, admin management (list, form, roles),
coaches, user broadcasts, tickets, comments, contact messages — plus the AI
assistant flows, which the completeness check surfaced.

### Two structural bugs fixed, not just gated

**1. "Promote to admin" was still on the users list — and had been dead since Phase 3.**

Phase 3 removed `admin` from the user-detail role dropdown and made the server
reject it outright (`resolveUserPatchPermissions({role:"admin"})` →
`admin-role-not-assignable-here`). But the users **list** still rendered
«ارتقا به مدیر» in both the row menu and the mobile card, wired to a
`handleChangeRole` that toggled `role` to/from `"admin"`. Every click had been
returning 403 for the whole of Phase 3–4, while still advertising a retired
concept as if it were the way to create an admin.

`handleChangeRole` and both buttons are deleted (not hidden), the now-unused
`Key` icon import with them. Role changes remain on the user detail page, which
has the correct dropdown. A test asserts the handler, the label and the
`nextRole` logic are all gone, and re-asserts the server rule.

**2. Two edit forms sent every field on every save, so they needed every key.**

`users/[userId]` PATCHed the entire `form` object each time. Because
`resolveUserPatchPermissions` requires **all** keys implied by the body, renaming
a user demanded `users.edit` **and** `users.changeRole` **and**
`users.adjustWallet` **and** `users.ban` simultaneously. Any admin holding fewer
than all four got a 403 for a name change.

`AdminForm` had the same shape: `{title, role, isActive, permissions}` always,
so editing a title required `admins.edit` + `admins.managePermissions` +
`admins.activate`/`revoke`.

Both now build a payload from *changed* fields the admin is *permitted* to
change, and each input is gated on its own key:

```
FIELD_PERMISSION = { name|lastName|email|phone|level → users.edit,
                     role → users.changeRole,
                     walletBalance → users.adjustWallet,
                     isBanned → users.ban }
```

Empty payload → no request, just a "nothing changed" toast. Tests assert the map
matches `resolveUserPatchPermissions` field by field.

### Direction-dependent keys

`resolveAdminPatchPermissions` requires `admins.activate` for `isActive: true`
and `admins.revoke` for `isActive: false`. The admins list toggle is therefore
gated as `admin.isActive ? can('admins.revoke') : can('admins.activate')` — a
single fixed key would have been wrong in one direction. `AdminForm` only sends
`isActive` when it actually changed, and checks the key for the new value.

### Other gates in this batch

| control | key |
|---|---|
| مسدودسازی/رفع مسدودیت (list) | `users.ban` |
| میان‌برهای اعلان/ادمین‌ها/مربیان | `canRoute` on the destination |
| مدیریت نقش‌ها / ساخت-ویرایش-حذف نقش | `roles.view` / `roles.create` / `roles.edit` / `roles.delete` |
| افزودن ادمین / حذف عضویت | `admins.create` / `admins.revoke` |
| انتخابگر دسترسی‌ها در فرم ادمین | `admins.managePermissions` |
| تأیید/رد درخواست مربیگری | `coaches.manage` |
| ردیف سفارش → صفحه‌ی کردیت | `canRoute` (`coaches.manageCredits`) |
| ارسال اعلان انبوه | `userNotifications.send` (صفحه با `.view` باز می‌شود) |
| پاسخ به تیکت / بستن-بازکردن | `tickets.reply` / `tickets.close` |
| تأیید-رد نظر / حذف نظر | `comments.moderate` / `comments.delete` |
| پیام‌های تماس (خوانده/بایگانی/حذف) | `contactMessages.manage` |
| دستیار هوش مصنوعی (محصول/ورزشکار) | `ai.productDraft` / `ai.athletePrompt` |

Where hiding a control would look like a bug, a one-line Persian note explains
it instead: the ticket composer, the broadcast send button, and the AI steps all
say what is missing rather than vanishing silently.

### The completeness check found the AI module

The new test `Phase 4 is complete: every admin module group has UI gates` walks
`PERMISSION_MODULES`, takes every non-`.view` key, and fails if a module has no
`can()` anywhere in `src/`. It caught **`ai`** — `POST /api/ai/product-draft`
and `/api/ai/athlete-prompt` are gated on their own keys, but the three flows
(`ProductCreateFlow`, `AddProductToCategory`, `AthleteCreateFlow`) offered the
"ساخت پرامپت" button to anyone who could reach the create page. An admin with
`products.create` but not `ai.productDraft` would hit a 403. Now gated.

The test's allowlist has exactly one entry with a real justification —
`pages`, whose only live action (`edit`) is a route of its own, gated with
`canRoute`; `pages.create/publish/delete` don't exist and are already recorded
in the Phase-5 orphan list — plus `dashboard`, `home`, `navbar` and `payments`,
which have no in-page action of their own.

### Checks (all run, output captured)

```
node --test tests/adminRbac.test.mjs               170 pass / 0 fail   (was 160)
node --test tests/adminRbacTransactions.test.mjs    24 pass / 0 fail
npm run verify:admin-auth                            0 violations, exit 0
npx next build                                       ✓ compiled, 0 prerender errors
eslint --quiet on the six changed people/support files
    before: 9 errors · after: 9 errors  → no new findings
```

The error count was measured by linting the exact changed set, stashing the
changes, and linting again — identical both times.

One pre-existing test needed updating, not weakening: `the admin form sends
only server-accepted fields` asserted `payload.userId = linkedUser._id`, which
moved into the create branch as `userId: linkedUser._id`. Its intent (explicit
payload, never a `...formData` spread) is unchanged and still asserted.

### Runtime checks (production build, real admin token)

All eight people/support pages returned **200** with no denials and no
read-only notices for a full-access admin, and **«ارتقا به مدیر» appears
nowhere in any rendered page**.

`/p-admin/users` and `/p-admin/users/admins` returned the panel chrome plus a
loading spinner rather than their action labels — both are client-fetch pages
(`AdminLoader` while SWR/`useEffect` runs), confirmed by probing for the spinner
marker. Same known limitation as `BrandAdminPage` (§17) and the order/analytics
pages (§18), not a gating regression.

---

## Phase 4 summary — what now exists

- **One permission source.** `resolveAdminContext()` feeds the middleware guard
  and the layout; the layout hands the same effective array to
  `AdminPermissionProvider`. Server components use `getAdminContext()` +
  `canAccessAdminRoute` directly. No parallel copy of the rules anywhere.
- **Navigation is guarded in middleware**, so full loads, RSC soft navigations
  and prefetches all pass through the same check — verified at runtime,
  including that a database outage fails closed (500, empty body).
- **Every module with a write action has a UI gate**, enforced by a test rather
  than by review.
- **Every gate uses the key its own API route enforces.** Where the API splits a
  concept (activate vs revoke, publish vs edit, reply vs close, export vs view),
  the UI splits it the same way.
- **Defects found and fixed along the way:** membership admins locked out of the
  panel entirely; no page-level authorization at all; the article editor open on
  `articles.view`; an ungated instalment cheque-clearing route trusting the JWT;
  a relative brand href; dead promote-to-admin buttons; two forms that demanded
  every permission to save any field; AI endpoints reachable without their keys.

### Still open (unchanged)

- **Limited-role runtime proof.** Every live check across §16–§20 ran as a
  *legacy* full-access admin, because the `admins` collection is empty. The deny
  paths are unit-tested but have never been observed in a browser. Proving them
  means writing one `Admin` membership document to the production database —
  held pending authorisation.
- **Client-fetch pages** render a spinner server-side, so their gates are
  covered by tests and the build but not by an observed render.
- Phase 5 inputs are already captured as a failing-if-changed test: the eight
  orphan keys, with `analytics.export` flagged as unenforceable server-side.

---

## 21. Phase 5 — permission registry reconciliation. **Complete.**

### The deliverable: a coverage matrix, not a one-off audit

`scripts/rbacCoverage.mjs` (`npm run rbac:coverage`) builds the machine-readable
matrix the phase asks for, linking all five layers:

```
صفحه‌ی پنل → اکشنِ دیده‌شده در UI → متد/روتِ API → کلیدِ دسترسی → آیتمِ منو
```

It reads the registry, both API manifests (**expanding branch resolvers**), the
page and route files on disk, every `can()`/`canRoute()` call site under
`src/app` and `src/components`, and the sidebar `menuItems`. `--json` emits the
matrix; the default output is a Persian report; exit code is 1 when any
**blocking** finding exists.

Findings carry stable codes so tests can reference them: `PAGE_UNMAPPED`,
`ROUTE_STALE`, `API_STALE`, `NAV_UNMAPPED`, `MODULE_PATH_STALE`,
`MODULE_API_STALE`, `KEY_UNUSED`, `KEY_UI_ONLY`, `KEY_TOO_BROAD`,
`KEY_PREREQUISITE_ONLY`, `MODULE_NO_UI_GATE`, `RETIRED_KEY_IN_USE`,
`DUPLICATE_LABEL`.

Every accepted exception lives in one exported `ACCEPTED` object with a written
reason, and a test asserts the list stays exactly four entries long **and** that
no reason is a one-word excuse.

### Four bugs in my own tool, found before trusting its output

The first run produced 7 blocking and 22 advisory findings. Most of the advisory
noise was the generator being wrong, not the code:

1. **Branch expansion ignored the method.** `resolveSiteSettingPermission(key, action)`
   maps GET→`.view` and PUT→`.edit`, but the generator credited *every* owner key
   to *both* methods — making `bankAccount.view` look like it authorized writes.
   Now action-aware.
2. **Module `api` paths are prefixes.** `/api/admin/payments` has no route file of
   its own, only `/[id]/approve` etc. Three false `MODULE_API_STALE` findings.
3. **"Too broad" was defined uselessly.** "A key covering both a read and a write"
   flagged 17 keys, nearly all legitimate — `admins.create` must read the candidate
   list, `userNotifications.send` must count recipients. Redefined to the case that
   actually matters: **a `.view` key that authorizes a write method.** That leaves
   one hit, accepted with a reason.
4. **A prerequisite is a use.** `payments.view` and `limitedEditions.view` looked
   dead, but `pruneUnsatisfiedDependencies` drops any action whose prerequisite is
   missing — retiring them would have silently disabled every payment and
   limited-edition action. Now reported as `KEY_PREREQUISITE_ONLY` (advisory).

Had I acted on the first report, #4 would have broken payment approval.

### Security finding: two admin-only endpoints were fully public

`GET /api/limited-editions` and `GET /api/limited-editions/[id]` had **no gate at
all** — not even an identity check. They look public, but every consumer is an
admin screen (product editor, `BrandAdminPage`, `LimitedEditionForm`, the admin
ref-data hook); the storefront reads limited editions through services
(`brandGrouped.service`, `query.service`) straight from the database. Anyone
unauthenticated could enumerate them over HTTP.

Both are now `limitedEditions.view` and in the manifest. Verified at runtime:

```
/api/limited-editions                            anon=401  admin=200
/api/limited-editions/<id>                       anon=401  admin=404
```

Same class as the instalment cheque route in §18 — a route outside `/api/admin`
that the Phase-2 scanner never looked at. The scanner's external-handler count
is now 53 (was 51).

### Publishing split from editing — the "too broad" case, fixed properly

The registry always had `articles.publish` and `pages.publish`; **nothing
enforced them**. Publishing was just a field inside the edit request, so anyone
who could write a draft could push it live. Both are now real branch resolvers:

| resolver | rule |
|---|---|
| `resolveArticlePatchPermissions` | no `status` → `articles.edit`; `draft`/`review`/`archived` → `articles.edit`; anything else (incl. unknown values) → `+ articles.publish` |
| `resolvePagePutPermissions` | `published` absent → `pages.edit`; explicit boolean → `+ pages.publish` |

Unknown status values fall to the **stricter** side, and *un*publishing needs only
`articles.edit` — taking content down is less dangerous than putting it up.

**Both fixes needed a matching change to avoid locking editors out**, and this is
the part that is easy to get wrong:

- The pages handler wrote `published: body.published !== false` on every save, so
  *any* save of a published page counted as publishing. It now writes `published`
  only when the body carries an explicit boolean, and `PageEditor` omits the field
  entirely when the admin lacks `pages.publish`. An edit-only admin can update the
  content of a live page without touching its published state.
- `ArticleEditor.save()` spreads the whole article, so it always sent
  `status: "published"` for an already-published article. It now drops `status`
  and `publishedAt` when the admin can't publish, and the publishing options are
  removed from the status `<select>`.

Without those two, "enforcing the publish key" would have meant "editors can no
longer save anything that is already live."

### Retirements

| key | decision | why |
|---|---|---|
| `pages.create`, `pages.delete` | **drop** | CMS pages are a fixed slug set (`PAGE_SLUGS`); neither operation exists |
| `orders.edit` | **ambiguous, not retired** | superseded by four fine-grained keys — but which one the holder meant is unknowable, so it goes in `AMBIGUOUS_PERMISSIONS` and the migration must decide explicitly |

`orders.edit` deliberately does **not** get an automatic rewrite to all four
keys: that would silently hand a holder of one vague key four distinct
authorities. `classifyPermissionKeys` checks `RETIRED` before `AMBIGUOUS`, so it
is registered in the ambiguous table only. A test pins that
`migratePermissionKeys(["orders.edit"]).permissions` is empty.

Registry: **135 keys → 132**, enforced by an API or route: **126 → 129**.

### Label and grouping pass

- `installments.edit` was labelled «ویرایش قرارداد اقساط» but is enforced on the
  cheque-status route (status, receipt, notes) — renamed to
  «ویرایش چک‌ها و اطلاعات اقساط».
- `pages.edit` → «ویرایش محتوای صفحه»; `pages.publish` →
  «انتشار / برداشتن از انتشار صفحه» (it gates both directions).
- The `ai` module claimed `path: "/p-admin/admin-products"`. It has no page of its
  own — it appears inside the product- and athlete-creation flows. Set to `null`
  with the description saying so.

A test now enforces that every module has a title and description, every key has
a Persian title, no title is pure ASCII or contains a placeholder, no two keys in
a module share a label, every module belongs to exactly one section, and every
non-null section path is a real admin route.

### Checks (all run, output captured)

```
npm run rbac:coverage                                0 blocking findings, exit 0
node --test tests/adminRbac.test.mjs               178 pass / 0 fail   (was 170)
node --test tests/adminRbacTransactions.test.mjs    24 pass / 0 fail
npm run verify:admin-auth                            0 violations (53 external handlers, was 51)
npx next build                                       ✓ compiled, 0 prerender errors
npm run audit:admin-rbac                             still blocked on the same 6 ambiguous keys
eslint --quiet on all Phase-5 files                  1 error, pre-existing in PageEditor.jsx
```

The lone eslint error was confirmed pre-existing by stashing and re-linting.

Runtime, production build:

```
PUT  /admin/pages          anonymous → 401   (identity before branch, as required)
PATCH /admin/articles/:id  anonymous → 401
PUT  /admin/pages          malformed body → 400 (not a 403)
PUT  /admin/pages          bad slug, no `published` → 400 — passed the gate with pages.edit alone
```

The last line is the one that matters: an edit-only request reached the handler
instead of being rejected by the publish key.

### Test bookkeeping

Three Phase-4 tests needed updating because the code got *stricter*, not looser:

- the article PATCH key assertion now expects the branch object plus a resolver
  round-trip;
- `editor pages rely on their route guard instead of a second gate` became
  `editors gate only what their route guard does not already cover` — EventForm
  must still have no gate, while ArticleEditor and PageEditor must gate **exactly**
  `[articles.publish]` / `[pages.publish]` and nothing else;
- the hand-maintained orphan-key list was **deleted** in favour of the coverage
  matrix, which computes the same thing branch- and prerequisite-aware. A comment
  points to the replacement so the removal is not mistaken for a gap.

### Remaining advisory findings (4, all with reasons)

| code | subject |
|---|---|
| `KEY_UNUSED` | `admins.viewActivity` — Phase 6 will enforce it |
| `KEY_UI_ONLY` | `analytics.export` — the export is built in the browser from data already fetched under `analytics.view`; **no server-side enforcement is possible**, so this gate is convenience, not control |
| `KEY_TOO_BROAD` | `collections.view` — `POST /admin/events/preview-products` is a read expressed as POST because it takes a bulky filter body |
| `KEY_PREREQUISITE_ONLY` | `payments.view` — not enforced directly, but prerequisite of approve/reject/edit |

### Still open

- **Phase 6** — admin activity audit (`admins.viewActivity` is waiting for it).
- **Phase 7** — migration, still blocked on the same 6 ambiguous keys
  (`events.*`, `finance.*`) on the role «مدیر محصولات». `orders.edit` is now also
  in the ambiguous table but no live role holds it, so the blocker count is
  unchanged.
- Limited-role runtime proof (unchanged from §16–§20): still requires writing an
  `Admin` membership to the production database.

---

## 22. Phase 6 — admin activity audit. **Complete.**

### Shape of the solution

| piece | file |
|---|---|
| append-only model | `models/AdminActivity.js` |
| service (record / redact / diff / request context) | `src/lib/adminActivity.js` |
| Persian action catalogue | `src/lib/activityLabels.js` |
| automatic capture | `src/lib/requireAdminPermission.js` |
| read-only API | `src/app/api/admin/activity/route.js` |
| timeline component | `src/components/admin/admins/ActivityTimeline.jsx` |
| admin detail page | `src/components/admin/admins/AdminDetail.jsx` + `p-admin/users/admins/[adminId]` |

### Capture strategy: automatic first, explicit where it adds value

The gate `requireAdminPermission()` is the one place *every* admin request
passes through, so it does the capture that must never be forgotten:

| what | when | result |
|---|---|---|
| every 401/403 | always, **awaited** | `denied` |
| every authorized **write** key | unless the route opts out | `attempted` |
| audited **reads** (`admins.viewActivity`, `analytics.export`) | always | `attempted` |

That covers all ~190 handlers with **zero per-route work**. On top of it,
routes that can produce a meaningful before/after call `auditor(ctx, …)` and
pass `{ audit: false }` to the gate so the timeline doesn't show the same act
twice. Instrumented so far: `role.create`, `role.update`, `role.delete`, and
the user PATCH (which names itself `user.ban` / `user.unban` /
`user.wallet.adjust` / `user.role.change` / `user.profile.update` **from the
actual diff**, so a ban never hides inside a generic "user edited").

**Not yet explicitly instrumented** (they still produce `attempted` records
with actor, key, IP and timestamp — just no diff): admin create/update/revoke,
order status, payment approve/reject/edit, site-settings, instalment cheques,
discounts, content publish. That is the honest state; the helper makes each one
a two-line addition.

### The bug that only running it could reveal

The first implementation fired denial records **without awaiting**. Runtime
check: a non-admin hit `/api/admin/users`, got the correct 403 — and the ledger
stayed empty. The handler returns immediately and the pending promise is cut
off before it reaches the database. Every single denial was being silently
dropped, which is precisely the record that matters most.

Denials are now awaited. A denied request has no user operation to protect, so
a few milliseconds cost nothing. Success-path records stay non-blocking, and
that asymmetry is written down in both files. Re-verified:

```
non-admin GET /api/admin/users -> 403
ledger: authz.denied | no-membership | keys=["users.view"] | status=403
```

A second runtime finding: `admins.viewActivity` doesn't end in `.view`, so the
first classifier called it a write — every time someone opened the audit log,
the log recorded a "write". Reads that are themselves sensitive now have their
own explicit set and their own action, `authz.read`.

### Reliability semantics (explicit, as the phase requires)

1. **Recording never breaks the operation.** Every failure is swallowed and
   logged to console; `recordAdminActivity` returns `false`. Proven by a test
   that feeds it invalid input and asserts no throw.
2. **Recording never grants anything.** The module only writes.
3. **Denials are durable, successes are best-effort.** Awaited vs not, above.
4. **Loss window:** a process crash can lose the last non-awaited record. Traded
   deliberately against breaking a user operation.

### Immutability — three layers, all tested against a real mongod

- no write method exists on the API (`POST`/`DELETE` → 405, verified);
- `strict: "throw"` plus a `pre('save')` hook that rejects re-saving an existing
  document;
- `pre` hooks on `updateOne`, `updateMany`, `findOneAndUpdate`,
  `findOneAndReplace`, `replaceOne`, `deleteOne`, `deleteMany`,
  `findOneAndDelete` — all throw.

The transaction suite proves each one on `MongoMemoryReplSet`, including that a
blocked update leaves the stored value untouched. Direct database access is of
course outside the application's reach, and the model comment says so rather
than overclaiming.

*(Hook style note: Mongoose 9 does not always pass `next` to a sync hook. The
first version relied on `next(err)` and the guard itself threw
`TypeError: next is not a function` — the tests caught it. Hooks now throw
directly.)*

### Redaction

Field-name based, so it works even when a caller forgets. Normalised names
(`access_token` = `accessToken`), recursive, and it also bounds size: strings
>500 chars truncate, arrays >50 collapse, depth >4 stops. Private document URLs
(`certificateImage`, `receiptImageUrl`, …) become `[سندِ خصوصی]`. For a secret
field the *fact* of a change is kept while both values become `[حذف‌شده]`.

`x-forwarded-for` is honoured only when trusted; `TRUSTED_PROXY=false` disables
it, because on a directly-exposed deployment that header is attacker-controlled
and would let someone forge the audit trail.

### API and UI

`GET /api/admin/activity` — `admins.viewActivity`, no write methods. Filters
(actor, action, result, resource, date range), whitelisted sort, hard limit 50.
Bad input is **422, not ignored** — silently dropping a malformed filter would
turn "show me this admin's actions" into "show me everything". Verified:

```
?actorUser=not-an-id → 422   ?action=nope.nope → 422
?result=maybe       → 422   ?sort=name        → 422
?limit=9999         → 200 with limit=50
POST / DELETE       → 405
```

The admin detail page (`/p-admin/users/admins/[adminId]`, reachable by clicking
a name in the list) shows identity, active/revoked status, role, **effective
permissions computed with the same registry function the server uses**, the
count of pages the admin can actually open, the visible sections, and the
timeline. A membership with no linked user, a banned user, or a revoked
membership gets an explicit "this is unusable" banner. Opening the page needs
`admins.view`; the timeline inside needs `admins.viewActivity` and says so when
absent.

### Checks

```
node --test tests/adminRbac.test.mjs               190 pass / 0 fail   (was 178)
node --test tests/adminRbacTransactions.test.mjs    30 pass / 0 fail   (was 24)
npm run rbac:coverage                                0 blocking findings
npm run verify:admin-auth                            0 violations (138 admin handlers)
npx next build                                       ✓ compiled, 0 prerender errors
eslint --quiet on all Phase-6 files                  clean
```

`admins.viewActivity` is now enforced, so the coverage matrix's
`PLANNED_KEYS` list is empty and advisory findings dropped 4 → 3.

### One thing to know

Verification ran against the **real database**, so the ledger now contains
**22 genuine records** from those requests (all `ip: ::1`):
`authz.granted ×12`, `authz.read ×7`, `authz.denied ×3`. I did not delete them —
removing rows from the audit ledger would mean bypassing the append-only guard
this phase exists to provide. Say the word if you want them cleared and I'll do
it explicitly via the driver.

### Still open

- **Phase 7** — migration, still blocked on the 6 ambiguous keys
  (`events.*`, `finance.*`) on «مدیر محصولات». Your decision.
- **Phase 8** — final verification.
- Explicit instrumentation for the remaining mutation routes listed above.
- Retention policy: `expiresAt` and its TTL index exist but are deliberately
  unset, so nothing expires until a policy is chosen.
- Limited-role runtime proof (unchanged since §16).

---

## 23. Phase 7 — migration and cutover. **Applied to production. Complete.**

### What was asked, and what the database actually held

Instruction: «مدیر محصولات» is gone — ignore it; of the current admins make
**only** `mosalehkamali@gmail.com` an admin, with full access.

Read-only inspection first (`--apply` was never the first command):

- **9** users had `role: "admin"` (earlier notes said 8 — 9 is correct).
- **0** `Admin` memberships, **0** `AdminRole` documents. The «مدیر محصولات»
  role really is gone, and with it the 6 ambiguous keys that had blocked
  Phase 7 since §15. **No ambiguity remained to resolve.**
- Target found and unique: `mosalehkamali@gmail.com` → `69820a82c2af56bf7187b13e`
  (Saleh Kamali), not banned.

### The finding that changed the plan

Demoting the other eight to `"user"` looked obvious. It was wrong for two of
them:

| user | evidence |
|---|---|
| `faseyfra@gmail.com` | `coachCode=TR3846`, coach application **approved**, wallet **10,000,000** |
| `info.tenador@gmail.com` | `coachCode=TR-5824`, approved, linked coach ref |

`role` is a **business** field that `"admin"` happened to be sitting on.
Blanket-demoting would have stripped two working coaches of their role and
broken coach-code lookups, wallet and credit flows — silently, with money
attached. So the migration uses a documented rule:

> approved coach application **and** a coach code → `"coach"`; everyone else → `"user"`.

Result: 2 → `coach`, 6 → `user`. None of them keeps panel access either way.

### The migration

`scripts/migrateAdminCutover.mjs` — new, targeted, and deliberately *not* the
existing `auditAdminRbac.mjs`, which migrates **all** legacy admins and would
have produced nine admins instead of one.

Safety properties, all exercised:

- dry-run by default; `--apply` required;
- refuses to run if the target is missing, banned, or ambiguous (duplicate
  email), or if more than one protected role exists;
- **refuses to write at all without transaction support**, so a half-applied
  cutover is impossible;
- writes a rollback snapshot **before** touching anything;
- membership is an `upsert` on `user`, so re-running changes nothing;
- re-reads and verifies the end state itself.

Applied output:

```
✓ فایلِ بازگردانی نوشته شد: rbac-cutover-rollback-2026-08-17T12-23-09-536Z.json
✓ نقشِ دسترسی کامل ساخته شد.
✓ عضویتِ ادمینِ هدف با نقشِ دسترسی کامل تضمین شد.
✓ 8 کاربر از نقشِ legacy خارج شدند.

کاربرانِ باقی‌مانده با role="admin": 1
عضویت‌ها: 1 (فعال: 1)
نقشِ محافظت‌شده: 6a82fd2d0189be97bcf10f83
✓ وضعیتِ نهایی همان چیزی است که باید باشد.
```

The rollback file lists every demoted user with its previous role, plus the ids
needed to undo the role/membership creation. It is now gitignored — it contains
user ids and belongs on your machine, not in the repo.

### Cutover, in the safe order

The legacy fallback was removed **after** the data migration was proven, not
before — so there was never a moment when nobody could get in.

1. Migrate data. Verify the target resolves **through the membership**: the
   activity ledger recorded `source=membership`, role «دسترسی کامل»,
   `isFullAccess=true`, **132 keys**.
2. Remove the fallback:
   - `decideMembershipAccess` no longer has a `legacy-user-role` branch;
     `hasLegacyAdminRole` stays in the signature but is inert, and a test pins
     that it makes **no difference at all**.
   - `resolveAdminContext` grants permissions **only** for
     `source === "membership"`; anything else is an empty array. Written as a
     positive condition so a future source fails closed, not open.
   - `src/lib/requireAdmin.js` — **deleted**. Its one remaining consumer,
     `ArticlePreview`, now gates on `articles.view` through the real context.
3. Verify again.

### Post-cutover verification (production build, real accounts)

Every token below **claims `role: "admin"`** — the point is to prove that claim
now buys nothing:

| account | `/api/admin/stats` | `/api/admin/users` | `/p-admin` |
|---|---|---|---|
| Saleh (membership, full access) | 200 | 200 | OK |
| ex-admin → coach | 403 | 403 | DENIED |
| ex-admin → coach #2 | 403 | 403 | DENIED |
| ex-admin → user | 403 | 403 | DENIED |
| plain user (never admin) | 403 | 403 | DENIED |

And for the one real admin: `/p-admin/users/admins`, `/p-admin/admin-products`,
`/p-admin/financial`, `/p-admin/support?tab=tickets` — all 200, none forbidden.

`npm run audit:admin-rbac` now reports a clean state: protected role present and
correct, 0 memberships to create, 0 keys to rewrite, **1 usable super admin, no
blockers.**

### Checks

```
node --test tests/adminRbac.test.mjs               191 pass / 0 fail   (was 190)
node --test tests/adminRbacTransactions.test.mjs    30 pass / 0 fail
npm run rbac:coverage                                0 blocking findings
npm run verify:admin-auth                            0 violations
npx next build                                       ✓ compiled
eslint --quiet on changed files                      clean
git diff --check                                     clean
```

Two tests changed meaning, both in the stricter direction:
`legacy fallback applies only when no membership exists` became
`the legacy User.role=admin fallback is gone`, and a new test asserts
`src/lib/requireAdmin.js` does not exist, `adminContext` has no
`getAllPermissionKeys`, and `adminGuards` contains no `legacy-user-role`.

### A long-standing gap, now half closed

Since §16 every runtime check ran as a *legacy* full-access admin, so deny paths
were unit-tested only. That is no longer true: four real accounts with no
membership now produce real 403s and real panel denials against a production
build. What remains unobserved is a **partially**-permissioned role (e.g. an
articles-only admin) — provable in minutes with a scratch membership if you want
it; I did not create one because you asked for exactly one admin.

### Decisions I made that you may want to revisit

1. **Saleh's own `role` is still `"admin"`.** It is inert now — panel access
   comes solely from the membership — but the users list will still badge the
   account «مدیر کل». You didn't ask me to change your business role, so I
   didn't. Say the word and it becomes `"user"`.
2. **Two accounts became `coach`, not `user`** — reasoning above.
3. **Ledger noise:** the verification requests wrote genuine records to the
   activity ledger (~40 now, all `ip: ::1`). Removing them would mean bypassing
   the append-only guard from Phase 6, so I left them.

### Still open

- **Phase 8** — final verification: negative tests per module, the four admin
  personas across desktop/mobile, direct URL and direct API attempts, and the
  final Persian report.
- Carried security items still unfixed: raw `$regex` in `GET /api/admin/users`;
  `/api/otps` (gated, recommended for deletion); `GET /api/product/[productId]`
  exposing deactivated products to any logged-in user; `PUT /api/banners/[id]`
  `$set: body` with no whitelist.
- Explicit audit instrumentation for the remaining mutation routes (§22).
- Audit retention policy (`expiresAt` deliberately unset).

---

## 24. Phase 8 — final verification. **All eight phases complete.**

### The gap that was open since §16 is closed

Every live check in Phases 4–7 ran as a *full-access* admin, because no limited
membership existed in the real database. "A restricted admin is actually
restricted" had only unit tests behind it. That claim is now backed by real
HTTP.

`scripts/verifyPersonas.mjs` boots a `MongoMemoryReplSet`, seeds four personas,
runs the **built** application against that database, and asserts a matrix of
real responses. **Nothing is written to production.** Every token deliberately
carries `role: "admin"` so the run also proves that claim is worthless.

| | full | read-only | articles-only | none |
|---|---|---|---|---|
| `/p-admin` | open | open | open | not-admin |
| `/p-admin/admin-products` | open | open | **denied** | not-admin |
| `/p-admin/admin-products/add` | open | **denied** | **denied** | not-admin |
| `/p-admin/admin-articles/new` | open | **denied** | open | not-admin |
| `/p-admin/users/admins` | open | **denied** | **denied** | not-admin |
| `/p-admin/financial` | open | **denied** | **denied** | not-admin |
| `GET /api/admin/activity` | 200 | 403 | 403 | 403 |
| `GET /api/admin/users` | 200 | 200 | 403 | 403 |
| `POST /api/admin/roles` | 422 | 403 | 403 | 403 |

The `422` matters: for the full persona the gate opened and the request reached
validation. A blanket 403 everywhere would have proven nothing.

Sidebar filtering verified from the served HTML — «مدیریت مالی» and
«بازار دست دوم» are **absent from the markup** for the read-only and
articles-only personas, not merely hidden with CSS. Direct attempts at
capabilities the UI never showed (deleting an article, reading bank-account
settings, patching a user, creating a role) all returned 403. Anonymous: 401 on
API, 307 to login on pages.

### Everything else the phase asked for

```
node --test tests/adminRbac.test.mjs               198 pass / 0 fail   (was 191)
node --test tests/adminRbacTransactions.test.mjs    30 pass / 0 fail
node scripts/verifyPersonas.mjs                      every matrix cell matched
npm run verify:admin-auth                            0 violations · 191 gated handlers
npm run rbac:coverage                                0 blocking findings
npm run audit:admin-rbac                             1 usable super admin, no blockers
npx next build                                       ✓ compiled
git diff --check                                     clean
```

Seven new unit tests generalise the matrix so it regresses without a server,
including the exhaustive form: for each persona, **every** route in the manifest
must open exactly when the persona holds its keys — not just the sampled ones.
Plus negative tests that a `.view` key never implies its write siblings, and
that dependency pruning can't smuggle an action in.

### Lint: 72 errors, 0 of them ours

Full-repo `eslint --quiet` reports 72 errors across 47 files. Categorised:

| rule | count |
|---|---|
| `react-hooks/set-state-in-effect` | 50 |
| `react-hooks/immutability` | 13 |
| `react-hooks/purity` | 8 |
| `react-hooks/static-components` | 1 |

**Errors in files this work created or owns: 0.** All are React-compiler rules
on pre-existing application code, and every file this work *modified* was
individually verified pre-existing-equal by stash-and-relint at the time of the
change.

### Public and mixed-use regression

The constraint from §3 was that public and user behaviour must not change and
`/api/upload` must never get a coarse admin gate. Verified against a production
build:

- `/api/sports`, `/api/brands`, `/api/categories`, `/api/navbar` — **200
  anonymous**, unchanged.
- `/api/auth/profile`, `/api/installments`, `/api/tickets` — **200** for a plain
  logged-in user.
- `/api/upload` — identical response for anonymous and logged-in, so **no admin
  gate was added**. (Note: it also appears to have *no* authentication at all —
  pre-existing, outside this work's scope, but worth knowing.)
- Storefront `/`, `/products`, `/second-hand` — **200**.
- `/api/limited-editions` — **401 anonymous**, which is the intended Phase-5
  fix, not a regression.

### Final report

Published as an artifact (Persian, RTL): implemented behaviour, the six security
guarantees with the mechanism behind each, the persona matrix, test evidence,
migration status, and the decisions left to the owner. It states the open items
plainly rather than burying them — including that `analytics.export` **cannot**
be enforced server-side and must not be counted as a control.

### Completion statement

The conditions the handoff set for declaring completion are met: the legacy
fallback is removed, the migration is applied and verified, the scanner and
coverage matrix report zero gaps, and the four-persona matrix passes against a
real build.

**Not committed.** All code changes remain in the working tree (214 entries).
The database changes are live.

### Carried forward, unresolved by design

- `GET /api/admin/users` raw `$regex` from user input.
- `/api/otps` — gated, recommended for deletion.
- `GET /api/product/[productId]` shows deactivated products to any logged-in user.
- `PUT /api/banners/[id]` `$set: body` with no whitelist.
- Explicit audit instrumentation for the remaining mutation routes (§22).
- Audit retention policy.
- The owner's own `User.role` is still `"admin"` (inert).
