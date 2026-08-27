# TASK FOR CLAUDE CODE — Build the Tenador "Racket Match" Recommendation System (`/match/racket`)

## 0. Context you must internalize before writing any code

You are working inside the existing **Tenador** codebase (tenador.com), a Persian-language (RTL, Jalali calendar) sports-equipment e-commerce platform.

- Stack: **Next.js (App Router)**, **MongoDB with Mongoose**, **Tailwind CSS**.
- The site already has a `/match` landing page with three entry points: `/match/racket`, `/match/string`, `/match/shoes`. These are live, real pages in **this same repository** — they are not an external reference. Live URLs for your own verification once you find the corresponding source files: `https://www.tenador.com/match`, `https://www.tenador.com/match/racket`, `https://www.tenador.com/match/string`, `https://www.tenador.com/match/shoes`. Locate and open the actual source files for these routes in the repo yourself before changing anything — do not assume their structure, and do not fetch the live URLs as a substitute for reading the source.
- **`/match/racket` already exists as a real page** with SEO metadata, hero copy, a full "metric guide" section explaining قدرت (Power), کنترل (Control), اسپین (Spin), راحتی ضربه (Comfort), بخشندگی (Forgiveness), مانورپذیری (Maneuverability), and پایداری (Stability), an FAQ section, and a placeholder line that currently just says "در حال یافتن برترین‌های کل فروشگاه..." (i.e. **the actual interactive matching engine and live results UI do not exist yet — this is what you are building**).
- The existing copy on the page already implies two entry paths: (a) search your **current racket** to get an "upgrade" recommendation, or (b) answer a step-by-step questionnaire from scratch. Support both.
- Design language: primary color `#aa4725`, secondary `#ffbf00`, dark background `#0d0d0d`, Vazirmatn font, Framer Motion for motion, existing product-card component(s) already used elsewhere on the site (category pages, compare page, etc.) — **you must find and reuse the real product card component, not invent a new visual style for it.**
- Known project sensitivities (do not violate):
  - The site previously hit Vercel free-tier limits (ISR Writes, Fluid CPU, Edge Requests, Function Invocations). **Do not design this feature as a heavily revalidated static page or as something that triggers ISR writes on every user interaction.** The interactive part must be a client-side "island" that calls a lightweight API route; the static SEO content (hero, metric guide, FAQ, steps) must remain server-rendered exactly as it is today.
  - This project has zero tolerance for side effects. Any change to the `Product` schema, admin forms, or shared components must be additive and backward-compatible — never remove or rename existing fields, never break other pages (`/match`, `/match/string`, `/match/shoes`, category pages, compare page, cart, admin product forms).
  - Code comments inside the codebase should be written in **Persian**, matching existing project convention. Variable/function names stay in English. All **user-facing UI text must be Persian**, right-to-left, and consistent in tone with the existing copy already on `/match/racket`.

### Mandatory first step: investigate before building

Before writing any implementation code, **explore the actual repository** and report back what you find for each of these before proceeding:

1. The exact file(s) that render `/match/racket` today (App Router path, e.g. `app/match/racket/page.jsx` or similar) and how `/match`, `/match/string`, `/match/shoes` are structured (shared layout? shared component?).
2. The current `Product` Mongoose schema — does it already have a tennis-racket-specific sub-schema or `specs` object? What racket-relevant fields (if any) already exist (weight, head size, grip, balance, string pattern, length, level, etc.)?
3. The existing product card component(s) used elsewhere on the site (compare page, category listing, "best in category" widgets) — exact import path and prop shape.
4. Any existing pattern for client-side "live filter" or "live compare" UI on the site (e.g. the compare page) you should follow for consistency (state management style, fetch pattern, loading states).
5. How admin product-create/edit forms are structured, so new racket-technical fields can be added to them consistently with the rest of the admin panel (same styling, same validation approach).

**Do not guess or invent any of the above. If something is ambiguous, ask a single clarifying question before proceeding rather than fabricating file paths or schema shapes.**

---

## 1. Goal

Build a fully working, production-quality **interactive racket-matching tool** at `/match/racket` that:

1. Asks the user an **adaptive multi-step questionnaire** (tap-friendly multiple-choice, not free text) about their player profile, physical ability, swing, playing style, and priorities.
2. Optionally lets the user **search for their current racket** (autocomplete search over existing racket products) as a starting point, matching the "upgrade my racket" copy already on the page. If the user provides a current racket, prefill/derive as much of the target profile as possible from it (per the "current racket" logic in the algorithm spec below), and still let them answer/override the remaining questions.
3. **Recomputes and re-renders recommendations live**, without a full page reload, every time the user changes an answer, revisits an earlier step, or adjusts a price-range filter.
4. Shows results as **exactly three ranked product cards**: Best Match, Alternative 1, Alternative 2 — each using the site's real existing product card component, each annotated with a short, plain-Persian "why this fits you" explanation and the specific trade-off versus the Best Match (per the algorithm's "Final Recommendation Format").
5. Lets the user set a **price range** (min/max) that acts as a hard filter combined with the algorithm's compatibility ranking.
6. Lets the user **go back and change any previously answered question** at any time (a clickable step indicator / "ویرایش پاسخ" affordance per step), with results updating instantly from wherever they left off — this is the core UX pattern to replicate from the reference site `extreme-tennis.fr/fr/x-match/raquette-tennis/trouver/` (step-based questionnaire on one side, a persistent/sticky live-updating result panel on the other, full freedom to revise any prior answer and instantly see the recommendation set change) — reproduce this **interaction pattern**, not their visual design; the visual design must follow Tenador's own design system.
7. Works correctly on mobile (stacked layout: questionnaire first, results below or in a collapsible/sticky-bottom panel) and desktop (two-column layout: questionnaire left/right per RTL, sticky results panel on the other side).
8. Preserves 100% of the existing static SEO content already on the page (hero text, metric-guide section, numbered steps, FAQ, metadata) — the new interactive quiz is inserted into the page, it does not replace the existing content.

---

## 2. Data model changes (additive only)

Based on what you find in step 0.2, extend the `Product` model (or its racket-specific sub-document) to hold whatever of the following fields are **not already present**, matching this reference shape (fields you cannot find a home for should go into a nested `racketSpecs` object rather than polluting the top-level schema):

```
unstrungWeight        // number, grams
strungWeight           // number, grams (optional)
headSize               // number, sq. in.
headSizeCategory       // enum: small | medium | large  (derivable, but store for fast filtering)
gripSizes              // array of enum: L0 L1 L2 L3 L4 L5
balance                // enum: head-light | even | head-heavy
balancePoint            // number, mm (optional, if available)
swingweight            // number (optional — only use in scoring if present, never invented)
length                 // number, inches (default 27 for adult)
stringPattern          // enum: 16x19 | 16x20 | 18x20
frameMaterial          // string
frameStiffnessRA       // number (optional)
powerLevel             // 1-5 or low/medium/high
controlLevel           // 1-5 or low/medium/high
spinPotential          // 1-5 or low/medium/high
maneuverability        // 1-5 or low/medium/high
stability              // 1-5 or low/medium/high
comfort                // 1-5 or low/medium/high
forgiveness            // 1-5 or low/medium/high
recommendedLevel       // enum: beginner | intermediate | advanced (multi-select allowed)
recommendedPlayingStyles // array: power | spin | control | all-court
recommendedPlayerTypes  // free text / array (junior, strong beginner, etc.) — optional
```

Rules:
- **Never invent or backfill values for existing products** you cannot verify from real product data. Missing fields must remain `null`/`undefined` and the matching engine must treat them as "unknown, exclude from scoring" per the algorithm's Missing Product Data Rule (see §32 of the attached logic document below) — do not guess swingweight from static weight, do not guess balance from marketing copy.
- Update the admin product create/edit form for the racket category so these fields are editable, using the existing admin UI conventions (styling, validation, layout) already in the codebase.
- If a migration script is needed, make it non-destructive and idempotent.

---

## 3. Recommendation engine — must be a pure, testable service

Implement the matching logic as an isolated module (e.g. `lib/racketMatch/engine.js` or wherever matches the project's existing conventions for business logic), completely decoupled from the UI, so it can be unit-tested. It must expose at least:

- `buildTargetProfile(answers, currentRacket?)` → returns a structured "target racket profile" object (weight range, head size range, balance, swingweight range, string pattern, length, stiffness/comfort preference, grip requirement, priority ranking) — implementing the logic in §27 of the attached document.
- `scoreProduct(product, targetProfile, weights)` → returns a numeric compatibility score using the weighting table in §21 of the attached document (Playing level 20%, Playing style 15%, Weight/Swingweight 15%, Head size 10%, Balance 10%, String pattern 10%, Power/Control preference 10%, Maneuverability/Stability 5%, Comfort/Stiffness 5%), **skipping any factor whose product data is missing** rather than penalizing or guessing it, and re-normalizing the remaining weights.
- `applyHardConstraints(products, targetProfile, priceRange)` → filters out products that violate grip-size compatibility, price range, junior/adult mismatch, or explicit availability, per §22.
- `rankProducts(...)` → returns the top 3 in the exact structure needed for the "Final Recommendation Format" (§28): Best Match, Alternative 1 (explicit trade-off vs Best Match), Alternative 2 (a different trade-off).
- `explainRecommendation(product, targetProfile)` → generates the short, **Persian**, non-technical "why it fits" text and the trade-off sentence, following the plain-language translation approach in §30 (never expose raw jargon like "swingweight" or "RA" to the end user unless the user has already demonstrated technical fluency — keep the tone like the existing site copy).
- Internally classify and (optionally) surface a confidence level (High/Medium/Low) per §29, and if confidence is Low due to a specific missing high-impact answer, the UI should gently prompt that one extra question rather than silently guessing.

**All of the classification rules, anti-mistake rules, trade-off rules, and the full decision tree must be implemented exactly as specified in the attached logic document below — this document is the authoritative source of truth for the algorithm. Do not simplify it into "beginner = light racket" style shortcuts; the whole point of the algorithm is to avoid those shortcuts (see its own §24 "Anti-Mistake Rules").**

---

## 4. Questionnaire (frontend) spec

Implement the Q&A using the **adaptive flow** described in §25/§26 of the attached document, translated into natural, non-technical Persian (per §30), as tap/click multiple-choice steps (reuse `ask_user_input_v0`-style single/multi-select interaction patterns already familiar from the rest of the product, but as real in-page UI components, not a separate tool):

Suggested step order (skip a step if it's already been answered via the "current racket" lookup, and skip clearly redundant secondary questions per §26):

1. سن (age) — only branch into junior sizing logic if relevant.
2. سابقه و سطح واقعی بازی (experience/level, using descriptive options, not just "beginner/intermediate/advanced" labels).
3. سرعت ضربه (swing speed): آهسته / متوسط / سریع / بسیار سریع.
4. سبک بازی (playing style): قدرتی / اسپین‌محور / کنترلی / همه‌کاره.
5. اولویت‌های اصلی (top 1-3 priorities): قدرت، کنترل، اسپین، مانورپذیری، پایداری، راحتی، بخشندگی — allow ranking or multi-select.
6. راکت فعلی (optional autocomplete search over existing racket products) + آنچه دوست دارید/ندارید درباره‌اش (structured multiple-choice like "خیلی سنگین است"، "قدرت کافی ندارم"، "احساس بی‌ثباتی می‌کند"، etc. — map each to the corresponding recommendation adjustment in §17).
7. اندازه دسته/گریپ (grip) — if unknown, show the store's hand-measurement guidance and default to "prefer smaller size" per §7 when the user is between two sizes.
8. بودجه (price range) — min/max, treated as a hard constraint.

Every step must:
- Be reachable and editable at any later point (a step indicator / "بازگشت و ویرایش" control).
- Trigger a debounced recompute call to the recommendation API and update the live results panel — never require the user to submit a final "search" button to see a first set of results; results should appear as soon as there's enough information for at least a Medium-confidence recommendation, and refine as more steps are answered.

---

## 5. Live results panel spec

- Sticky/persistent panel next to (desktop) or below/collapsible-sticky (mobile) the questionnaire.
- Always shows exactly 3 cards using the **real, existing** product card component (found in step 0.3), passing through whatever props it needs (image, name, price, link, add-to-cart), plus an additional small "چرا این مناسب شماست" explanation block and a labeled trade-off line for Alternative 1 / Alternative 2, per §28's format.
- Price-range control lives in this panel or directly above it and immediately re-filters/re-ranks.
- Skeleton/loading state while the API call is in flight; never show a flash of empty/zero results — keep the previous result set visible (slightly dimmed) until the new one arrives.
- If, after applying all hard constraints (grip, price, junior/adult), fewer than 3 products qualify, relax the price constraint last (explain this to the user) rather than showing an empty state, and never relax grip-size compatibility.

---

## 6. API

Add a lightweight route (e.g. `app/api/match/racket/route.js`, matching existing API route conventions in the repo) that:
- Accepts the current answer state + price range.
- Runs the engine server-side (so the full racket catalog/scoring logic never has to ship to the client).
- Returns the ranked 3 products (already populated with the fields the product card component needs) plus their explanation text and the confidence level.
- Is fast and does not do anything that would count against the project's known Vercel free-tier constraints (no per-keystroke full-catalog refetch from scratch if avoidable — pre-filter by category/level in the DB query itself, project only needed fields, add DB indexes if the query pattern needs them).

Also add a small autocomplete endpoint (or reuse an existing product-search endpoint if one already exists — check first) for the "search your current racket" step.

---

## 7. SEO / non-functional requirements

- Do not touch or regress the existing metadata (`title`, `description`, OG tags) already configured for `/match/racket`.
- Keep the hero, metric-guide section, the 3-step explanation, and the FAQ exactly as they are today, server-rendered — the questionnaire/results widget is a client component mounted inside this existing page, not a replacement of it.
- Add `FAQPage` JSON-LD structured data generated from the FAQ content that's already on the page (if not already present).
- Ensure no hydration mismatch errors and no layout shift regressions from inserting the new interactive block.
- Do not introduce new heavy client bundles unnecessarily (lazy-load the questionnaire widget if it materially affects initial load).

---

## 8. Anti-mistake rules for you (Claude Code), specific to this task

- Do not touch `/match/string`, `/match/shoes`, the `/match` landing page, global Tailwind config, or any shared layout/theme file beyond what's strictly required to mount this feature.
- Do not remove or rename any existing `Product` schema field.
- Do not invent product specification values under any circumstance — if data is missing, the engine must exclude that factor from scoring exactly as instructed above, and say so in its confidence logic, never in user-facing copy as a technical caveat (keep user-facing copy simple, per §30).
- Do not hardcode any "beginner = X racket" shortcuts — implement the actual multi-factor decision tree.
- Keep code comments in Persian, identifiers in English, UI copy in Persian, consistent with the rest of the codebase.

---

## 9. What to deliver at the end

1. A short report of what you found during the investigation step (§0), including exact file paths.
2. A list of every new file and every modified existing file, one line each describing the change.
3. Any assumptions you had to make, called out explicitly.
4. Confirmation that the project still builds and that you did not touch unrelated pages/components.
5. A brief Persian-language summary at the end of your work suitable for showing to the store owner (non-technical), separate from the technical file list.

---

## APPENDIX — Authoritative racket-matching logic document (use verbatim; do not simplify)

> The following is the full knowledge base, decision tree, scoring rules, and anti-mistake rules for the recommendation algorithm. Implement the engine so that it matches this document's rules exactly. Where this appendix and any of your own assumptions conflict, this appendix wins.

# Tennis Racket Recommendation Engine

## Knowledge Base, Q&A Flow, Decision Rules, and Recommendation Logic

### 1. Purpose

You are a Tennis Racket Recommendation Engine.

Your job is not to recommend a racket simply because a user is a beginner, intermediate, advanced player, male, female, strong, or weak.

Your job is to determine the **best racket profile for the individual player** by analyzing multiple factors together:

* Playing level
* Age and physical development
* Height and body size when relevant
* Physical strength and ability to control racket weight
* Swing speed
* Swing style
* Playing style
* Desired balance between power and control
* Desired spin
* Maneuverability requirements
* Comfort requirements
* Racket weight
* Head size
* Grip size
* Balance
* Swingweight
* String pattern
* Racket length
* Frame stiffness
* Existing racket and what the player likes/dislikes about it
* Budget and available products

The final recommendation must be based on **player–racket compatibility**, not on a single specification.

---

# 2. Core Principle

There is no universally "best" tennis racket.

The correct racket is the one whose characteristics match the player's:

1. Technical ability
2. Physical ability
3. Swing characteristics
4. Playing style
5. Performance priorities
6. Comfort requirements

Never assume:

* heavier = better
* more expensive = better
* professional racket = better
* larger head = always better
* 16×19 = always better
* 18×20 = always better
* head-heavy = always more powerful
* beginner = automatically needs the lightest racket
* men need larger grips than women
* a racket used by a professional player is appropriate for the customer

The recommendation must explain **why** the racket fits the player and what trade-offs it has.

---

# 3. Information Collection Strategy

Do not ask every possible question.

Use an **adaptive Q&A flow**.

Ask only the questions needed to reach a reliable recommendation.

Start with high-impact questions and only ask secondary questions when necessary.

## Priority Order

### Question 1 — Age

Ask:

> How old are you?

If the player is a child or young teenager, do not use adult racket rules automatically.

For junior players, age is only a starting point. Height, body size, strength, coordination, and ability to control the racket are more important.

---

### Question 2 — Height

Ask height when:

* The player is a junior
* The player is unusually tall or short
* Racket length may be relevant

For most adult players, height alone should not determine racket selection.

---

### Question 3 — Playing Experience

Do not rely only on the words "beginner", "intermediate", or "advanced".

Ask questions that reveal actual ability.

For example:

> How long have you been playing tennis?

and, if necessary:

> How would you describe your current game?

Possible answers:

* I just started
* I can rally but still struggle with consistency
* I can consistently rally from the baseline and control my shots
* I play regularly and have developed a full swing
* I compete in tournaments / competitive matches
* I have a highly developed technique and can generate my own power and spin

Use the player's actual ability rather than their self-assigned level.

---

# 4. Playing Level Classification

Use the following as a guideline, not as rigid boundaries.

## Beginner

Typical characteristics:

* New to tennis
* Developing basic technique
* Inconsistent contact
* Short or incomplete swings
* Does not consistently generate enough racket-head speed
* Needs forgiveness and easy handling
* Benefits from easy access to power

Typical racket profile:

* Unstrung weight: approximately 250–280g
* Head size: approximately 100–110 sq.in.
* String pattern: commonly 16×19
* Standard length: approximately 27"
* Moderate or high maneuverability
* Forgiving sweet spot
* Comfortable and easy to swing

A lighter racket and larger head generally make it easier for beginners to control the racket and tolerate off-center contact.

---

## Intermediate

Typical characteristics:

* Understands basic technique
* Can rally consistently
* Has developed a more complete swing
* Can generate some racket-head speed
* Wants a better balance of power, control, spin, and stability

Typical racket profile:

* Unstrung weight: approximately 275–300g
* Head size: approximately 98–102 sq.in.
* String pattern: 16×19 or 16×20
* Graphite construction
* Balanced combination of maneuverability and stability

Do not automatically recommend 300g just because the player is intermediate.

The player's swing speed and physical ability must also be considered.

---

## Advanced

Typical characteristics:

* Developed technique
* Full and fast swing
* Can generate their own power
* Good timing
* Strong racket control
* Regular competitive or high-level play
* Can handle higher swingweight

Typical racket profile:

* Unstrung weight: approximately 295–330g or more
* Head size: approximately 95–100 sq.in.
* String pattern: 16×19, 16×20, or 18×20
* Higher stability
* More control-oriented characteristics
* Often head-light when the racket is heavy
* Higher swingweight may be acceptable

Advanced players can benefit from heavier rackets because of their stability, but only when they can move and control the racket efficiently.

---

# 5. Racket Weight

Always distinguish between:

* **Unstrung Weight**
* **Strung Weight**

When comparing rackets, use the same measurement basis.

The recommendation engine should primarily use **unstrung weight** when the product database provides it.

## General Weight Zones

### Light

Approximately:

**265–285g**

Typical advantages:

* Easier maneuverability
* Easier acceleration
* Easier for beginners
* Less physically demanding

Typical disadvantages:

* Less stability against heavy incoming balls
* Can feel less solid against powerful opponents

---

### Medium

Approximately:

**285–300g**

Typical advantages:

* Good balance between maneuverability and stability
* Suitable for many intermediate players
* Versatile for all-court play

---

### Heavy

Approximately:

**300g+**

Typical advantages:

* Greater stability
* More plow-through
* Better resistance against powerful incoming shots
* Potentially better control for technically developed players

Typical disadvantages:

* Requires more strength and swing speed
* More physically demanding
* Can reduce racket-head speed if the player cannot control it

Important:

**Do not recommend a heavy racket simply because the player wants more power.**

Swingweight, balance, technique, and racket-head speed matter as well.

A heavier racket is not automatically better.

---

# 6. Head Size

Head size is measured in square inches.

Use these practical categories:

### Small Head

Approximately:

**95–98 sq.in.**

Typical characteristics:

* More precision-oriented
* More control-oriented
* Smaller sweet spot
* Less forgiving
* Better suited to technically developed players

---

### Medium Head

Approximately:

**99–102 sq.in.**

Typical characteristics:

* Balanced power and control
* Good versatility
* Suitable for many intermediate and advanced players

---

### Large Head

Approximately:

**103–115 sq.in.**

Typical characteristics:

* Larger sweet spot
* More forgiving
* Easier access to power
* Better for beginners or players who frequently miss the center

The larger the head, the more forgiveness and generally easier power it can provide; smaller heads tend to favor precision and maneuverability.

Do not treat these categories as absolute.

For example:

A strong intermediate player may prefer a 98 sq.in. racket.

A technically competent player may still prefer a 100 sq.in. racket.

---

# 7. Grip Size

Use the following mapping:

| Grip | Circumference |
| ---- | ------------: |
| L0   |            4" |
| L1   |           4⅛" |
| L2   |           4¼" |
| L3   |           4⅜" |
| L4   |           4½" |
| L5   |           4⅝" |

Do not determine grip size based on gender.

Hand size is more important.

If the player is between two sizes, the smaller grip can often be increased slightly using an overgrip.

A grip that is too large can make the racket harder to control and may force the player to squeeze the handle excessively.

## Grip Measurement Question

If the user does not know their grip size, ask them to measure their hand according to the store's provided measurement method.

If the result is between two sizes:

> Prefer the smaller size when appropriate, because adding an overgrip can increase the handle size.

Do not make grip size the primary determinant of racket performance.

It is a **fit requirement** that should be satisfied before ranking otherwise similar rackets.

---

# 8. Balance

Balance describes where the racket's weight is distributed.

There are three main categories.

## Head Light

Weight is distributed more toward the handle.

Typical characteristics:

* Higher maneuverability
* Faster changes of direction
* Easier at the net
* Easier for quick reactions
* Common on heavier control-oriented rackets

Good for:

* Advanced players
* Fast swings
* All-court players
* Players who value maneuverability

---

## Even Balance

Weight is distributed relatively evenly.

Typical characteristics:

* Balanced power
* Balanced stability
* Balanced maneuverability

Good for:

* All-court players
* Intermediate players
* Players who want versatility

---

## Head Heavy

More weight is distributed toward the racket head.

Typical characteristics:

* Can provide additional stability
* Can help generate power
* Can feel more demanding during fast racket movement
* May reduce maneuverability for some players

Good for:

* Players looking for easier power
* Players who can handle the additional swing demand
* Some recreational and beginner/intermediate profiles

Important:

**Do not use balance alone to predict power.**

Static weight and especially swingweight must also be considered.

---

# 9. Swingweight

Swingweight is one of the most important advanced variables.

Two rackets can both weigh 300g but feel completely different during the swing.

A racket with higher swingweight generally:

* Feels heavier during the swing
* Has greater stability
* Requires more effort to accelerate
* Can produce more plow-through

A racket with lower swingweight generally:

* Is easier to accelerate
* Is easier to maneuver
* Is better for quick reactions
* May feel less stable against heavy shots

Therefore:

**Never compare rackets using static weight alone if swingweight data is available.**

If swingweight is available in the product database, use it as a major ranking factor.

---

# 10. String Pattern

Common patterns:

* 16×19
* 16×20
* 18×20

## 16×19

Relatively open pattern.

Typical tendencies:

* Easier access to spin
* More dynamic ball response
* Good combination of power and spin
* Popular for modern baseline tennis

Best suited to:

* Spin-oriented players
* Intermediate players
* Aggressive baseline players
* Players who want easier access to spin

---

## 16×20

Middle ground.

Typical tendencies:

* More control than many 16×19 setups
* Still provides access to spin
* Good balance between spin and control

Best suited to:

* All-court players
* Intermediate/advanced players
* Players who want a compromise between open and dense patterns

---

## 18×20

Dense pattern.

Typical tendencies:

* More control
* More predictable launch
* More precision-oriented response
* Usually less spin-friendly than an otherwise comparable open pattern

Best suited to:

* Advanced players
* Flat hitters
* Control-oriented players
* Players with fast, consistent swings

Important:

**Do not say that 16×19 automatically produces more spin.**

Spin also depends on:

* Swing technique
* Racket-head speed
* String type
* String tension
* Head size
* Racket design

The string pattern is only one part of the equation.

---

# 11. Racket Length

For most adult players:

**27 inches = standard default**

Longer rackets can provide:

* More reach
* More leverage
* Potentially more power

But they can also provide:

* Less maneuverability
* More difficulty during quick reactions

Therefore:

### Standard 27"

Default recommendation for most adult players.

### 27.5–29"

Consider only when there is a specific reason, such as:

* Player wants additional reach
* Player wants additional leverage
* Player has sufficient control
* Player's playing style benefits from extra length

Do not recommend an extended racket simply because the user wants more power.

Standard adult rackets are generally around 27", while longer rackets can increase leverage and reach at the expense of maneuverability. The ITF rules permit adult rackets up to 29 inches overall length.

---

# 12. Frame Material and Stiffness

Most intermediate and advanced rackets use graphite or graphite-based composites.

Frame stiffness can affect:

* Feel
* Power response
* Energy transfer
* Vibration
* Comfort

Treat frame stiffness as a **secondary recommendation variable**, not as the first filter.

If a player prioritizes comfort, do not evaluate stiffness independently from:

* String type
* String tension
* Racket weight
* Swingweight
* Balance

The same racket can feel very different depending on its string setup.

---

# 13. Playing Style

Playing style is one of the most important parts of the recommendation.

## Spin-Oriented Baseline Player

Typical profile:

* Heavy topspin
* Fast racket-head speed
* Baseline-oriented
* Aggressive forehand
* Uses spin to control trajectory

Prefer:

* 16×19
* Good maneuverability
* Medium-to-large head size depending on skill
* Moderate swingweight
* Enough stability for heavy baseline exchanges

---

## Power-Oriented Player

Typical profile:

* Wants easy depth
* Does not naturally generate enough power
* Shorter or moderate swing
* Wants the racket to help produce pace

Prefer:

* Larger head
* Appropriate weight rather than simply maximum weight
* Moderate or head-heavy balance when appropriate
* Forgiving frame
* Suitable swingweight

Do not simply select the heaviest racket.

---

## Control-Oriented Player

Typical profile:

* Generates their own power
* Fast and complete swing
* Wants predictable response
* Values placement over easy power

Prefer:

* 95–100 sq.in.
* 16×20 or 18×20 when appropriate
* Higher stability
* Potentially higher weight/swingweight
* Often head-light balance

---

## All-Court Player

Typical profile:

* Baseline + net play
* Uses forehand, backhand, serve, volley
* Wants versatility

Prefer:

* Approximately 98–102 sq.in.
* 275–305g depending on ability
* 16×19 or 16×20
* Even or moderately head-light balance
* Balanced power/control characteristics

---

## Beginner With Limited Strength

Prefer:

* Lighter racket
* Larger head
* High forgiveness
* Easy maneuverability
* Standard 27" length
* 16×19 or similarly forgiving pattern

Avoid:

* Very heavy racket
* Very small head
* High swingweight
* Extremely control-oriented racket

---

## Strong Beginner

Do not automatically force the player into a very light beginner racket.

A strong, athletic beginner may be able to handle a somewhat heavier frame, for example around 275–290g, if the racket remains easy enough to maneuver.

The recommendation should depend on **actual racket control**, not the label "beginner".

---

# 14. Junior Players

Junior racket selection is different.

Use:

* Age
* Height
* Body size
* Strength
* Coordination
* Ability to control the racket
* Playing environment

as the main factors.

Typical junior lengths:

* 19"
* 21"
* 23"
* 25"
* 26"
* Adult length around 27"

Approximate age ranges can be used only as a starting point.

For example:

* 19": very young children
* 21": around 5–6
* 23": around 7–8
* 25": around 9–10
* 26": older/larger juniors transitioning toward adult rackets

Do not use age alone.

A child who is physically larger and more coordinated may need a different racket than another child of the same age.

USTA similarly emphasizes proper racket sizing for junior players and uses shorter racket lengths for younger players.

---

# 15. Physical Ability

Ask:

> How would you describe your physical strength and ability to swing a racket?

Possible answers:

* Below average
* Average
* Athletic
* Strong
* Very strong

But do not use this answer alone.

Combine it with:

* Playing level
* Swing speed
* Session duration
* Current racket weight
* Current racket experience

A strong beginner is not necessarily ready for a 320g control racket.

A technically advanced but smaller player may prefer a 295–305g racket over a 320g racket.

---

# 16. Swing Speed

Ask:

> How would you describe your swing speed?

Possible answers:

* Slow
* Moderate
* Fast
* Very fast

General logic:

### Slow swing

Favor:

* Easy power
* Larger head
* Moderate/light weight
* Forgiving racket

### Moderate swing

Favor:

* Balanced racket
* Medium head
* Medium weight

### Fast swing

Favor:

* More control
* Greater stability
* Potentially smaller head
* Potentially higher swingweight

### Very fast swing

Consider:

* Heavier frame
* Higher stability
* Control-oriented head size
* Dense or semi-dense string pattern when appropriate

---

# 17. Current Racket Question

Whenever possible, ask:

> What racket are you currently using?

Then ask:

> What do you like and dislike about your current racket?

This is extremely valuable.

For example:

### "My racket feels too powerful."

Possible recommendation:

* Smaller head
* More control-oriented string pattern
* More stable/heavier control frame
* Different balance

### "My racket feels too difficult to swing."

Possible recommendation:

* Lower weight
* Lower swingweight
* More head-light or maneuverable setup
* Possibly larger head

### "I cannot generate enough power."

Possible recommendation:

* Larger head
* More forgiving frame
* Appropriate weight
* More power-oriented balance
* Suitable string setup

### "I want more spin."

Possible recommendation:

* 16×19
* Good maneuverability
* Appropriate swingweight
* Spin-friendly frame
* Consider string setup

### "My racket feels unstable against hard shots."

Possible recommendation:

* Higher stability
* More swingweight
* Potentially higher static weight
* Appropriate balance

---

# 18. Comfort and Arm-Friendliness

If the player reports discomfort or strongly prioritizes comfort, treat comfort as a high-priority requirement.

Ask:

> Is comfort important to you, or have you experienced discomfort while playing with your current racket?

If yes, avoid blindly recommending:

* Extremely stiff frames
* Excessively heavy/swingweight-heavy setups
* Very demanding control rackets

Also consider the interaction between:

* Frame stiffness
* Weight
* Swingweight
* Balance
* String type
* String tension

Do not claim that a particular racket is medically safe or will prevent injury.

Instead say:

> This setup is generally more comfort-oriented, but individual response varies.

---

# 19. Performance Priority

Ask the user to choose their top priorities.

Possible options:

1. Power
2. Control
3. Spin
4. Maneuverability
5. Stability
6. Comfort
7. Forgiveness
8. All-around balance

Allow multiple choices.

Then determine the priority hierarchy.

Example:

> Power > Spin > Maneuverability > Control

means the system should prioritize rackets with easy power and spin while still maintaining acceptable handling.

---

# 20. Recommendation Decision Tree

Use this sequence.

### Step 1 — Junior or Adult?

If junior:

→ Use junior sizing logic.

If adult:

→ Continue.

### Step 2 — Playing Level

Classify:

* Beginner
* Intermediate
* Advanced

### Step 3 — Physical Ability

Determine whether the player can comfortably handle:

* Light
* Medium
* Heavy
  rackets.

### Step 4 — Swing Speed

Determine:

* Slow
* Moderate
* Fast
* Very fast

### Step 5 — Playing Style

Determine:

* Power
* Spin
* Control
* All-court

### Step 6 — Main Priority

Determine the user's top 1–3 priorities.

### Step 7 — Technical Profile

Generate a target racket profile:

* Target weight
* Target head size
* Target balance
* Target swingweight
* Target string pattern
* Target length
* Comfort/stiffness preference
* Grip size

### Step 8 — Product Matching

Compare the target profile against available products.

### Step 9 — Rank Products

Return:

1. Best Match
2. Strong Alternative
3. Alternative With a Different Trade-off

Do not return 10 random products.

---

# 21. Product Matching Score

If product data is available, calculate a compatibility score.

Suggested weighting:

| Factor                      | Weight |
| --------------------------- | -----: |
| Playing level compatibility |    20% |
| Playing style               |    15% |
| Weight / Swingweight        |    15% |
| Head size                   |    10% |
| Balance                     |    10% |
| String pattern              |    10% |
| Power / Control preference  |    10% |
| Maneuverability / Stability |     5% |
| Comfort / Stiffness         |     5% |

Total:

**100%**

Grip size should normally be treated as a **compatibility requirement**, not simply another preference score.

Budget and product availability should act as hard constraints when the user explicitly provides them.

---

# 22. Hard Constraints vs Soft Preferences

This distinction is critical.

## Hard Constraints

If known, do not violate these without explicitly explaining why:

* Junior/adult size
* User's required grip size
* Budget
* Product availability
* Specific competition requirements
* Maximum physical capacity when clearly stated

## Soft Preferences

These can be traded against each other:

* Power
* Control
* Spin
* Stability
* Maneuverability
* Weight
* Head size
* Balance
* String pattern
* Comfort

Example:

A player may want:

> maximum power + maximum control + maximum maneuverability + maximum stability

This is impossible to maximize simultaneously.

The Agent must explain the trade-off rather than pretending that one racket can maximize everything.

---

# 23. Trade-Off Rules

Use these relationships:

### More Power

Usually move toward:

* Larger head
* More forgiving frame
* Appropriate higher swingweight
* More power-oriented balance
* Open string pattern when appropriate

Trade-off:

* Less precision or maneuverability may occur.

### More Control

Usually move toward:

* Smaller/medium head
* More stable frame
* Denser string pattern
* More control-oriented design

Trade-off:

* Requires better technique and usually more self-generated power.

### More Spin

Usually move toward:

* Open string pattern such as 16×19
* Good maneuverability
* Appropriate racket-head speed
* Spin-friendly frame

Trade-off:

* Launch angle and control characteristics may change.

### More Maneuverability

Usually move toward:

* Lower weight
* Lower swingweight
* Head-light balance
* Standard length

Trade-off:

* Stability may decrease.

### More Stability

Usually move toward:

* Higher swingweight
* Higher static weight
* Appropriate balance

Trade-off:

* Maneuverability and fatigue can become concerns.

### More Forgiveness

Usually move toward:

* Larger head
* Moderate/light weight
* Easier-to-swing frame

Trade-off:

* Precision may be lower than a small-head control racket.

---

# 24. Important Anti-Mistake Rules

The Agent MUST NOT make these mistakes.

### Mistake 1

> "You're a beginner, so you need a 260g racket."

Incorrect.

The system must consider physical strength, swing speed, head size, and playing goals.

---

### Mistake 2

> "300g is better because you're an advanced player."

Incorrect.

Only recommend heavier rackets if the player can generate and maintain sufficient racket-head speed and control.

---

### Mistake 3

> "16×19 is always better because it gives more spin."

Incorrect.

Spin depends on the complete racket and string setup plus player technique.

---

### Mistake 4

> "Head-heavy means this racket is definitely more powerful."

Incorrect.

Power depends on several interacting variables, including swingweight, racket design, head size, balance, and player swing.

---

### Mistake 5

> "Women should use L2 and men should use L3."

Incorrect.

Grip size depends primarily on hand size, not gender.

---

### Mistake 6

> "This is a professional racket, therefore it is better."

Incorrect.

Professional rackets can be too demanding for recreational or beginner players.

---

### Mistake 7

> "This racket is used by [professional player], so you should buy it."

Incorrect.

Professional players often have completely different technical and physical requirements.

---

### Mistake 8

> Recommend based only on static weight.

Incorrect.

Always consider swingweight and balance when data is available.

---

# 25. Minimum Q&A Flow

For a normal adult user, try to reach a recommendation with approximately **6–8 questions**.

Recommended sequence:

### Q1

> What is your age?

### Q2

> How long have you been playing tennis, and how would you describe your current level?

### Q3

> How would you describe your swing speed: slow, moderate, fast, or very fast?

### Q4

> What is your playing style: power, spin, control, all-court, or a combination?

### Q5

> What matters most to you: power, control, spin, maneuverability, stability, comfort, or forgiveness?

### Q6

> What racket are you currently using, and what do you like or dislike about it?

### Q7

> Do you know your grip size? If not, can you measure your hand?

### Q8

> What is your budget?

Only ask additional questions when the answers are ambiguous.

---

# 26. Adaptive Questions

The Agent should ask follow-up questions only when they change the recommendation.

Example:

If the user says:

> "I'm 30, beginner, 185cm, athletic, fast swing, and want more control."

Do NOT ask unnecessary questions.

The system already has enough information to create a preliminary profile.

However, if the user says:

> "I'm intermediate and want a racket with more power."

Ask:

> What racket are you using now, and does it feel too heavy, too light, or simply not powerful enough?

This question may significantly change the recommendation.

---

# 27. Target Racket Profile

Before selecting a product, the Agent should internally generate something like:

```text
Player Profile:
Level: Intermediate
Swing Speed: Fast
Style: Aggressive Baseline
Priority: Spin + Control
Physical Ability: Athletic
Comfort Priority: Medium
Grip: L3
Budget: €200

Target Racket:
Weight: 285–300g unstrung
Head Size: 98–102 sq.in.
String Pattern: 16×19
Balance: Even to Head Light
Swingweight: Medium to moderately high
Length: 27"
Construction: Graphite
Overall Character: Spin-oriented, stable, moderately powerful, control-friendly
```

Only after creating this target profile should the system match actual products.

---

# 28. Final Recommendation Format

When recommending products, use this structure:

## Best Match

**[Product Name]**

**Why it fits:**

* Weight:
* Head size:
* Balance:
* String pattern:
* Swingweight:
* Playing style:
* Level:
* Main advantage:

**Why it matches this player:**

Explain the connection between the player's answers and the racket's specifications.

---

## Alternative 1

**[Product Name]**

Explain the main difference.

Example:

> This is slightly heavier and more stable, but less maneuverable than the Best Match.

---

## Alternative 2

**[Product Name]**

Explain the different trade-off.

Example:

> This model is lighter and more forgiving, making it easier to swing, but it gives up some stability against heavy shots.

---

# 29. Recommendation Confidence

The Agent should internally classify confidence:

### High Confidence

Enough information is available and the player's requirements clearly match the racket.

### Medium Confidence

The recommendation is reasonable but one or two important variables are unknown.

### Low Confidence

Important information is missing, such as:

* Grip size
* Player level
* Swing speed
* Physical ability
* Playing style

When confidence is low, ask another question instead of pretending to know.

---

# 30. If the User Does Not Know Technical Terms

Never force the user to understand:

* Swingweight
* Balance point
* RA
* String pattern
* Head size
* Plow-through

Translate technical specifications into practical questions.

Instead of:

> "Do you prefer high swingweight?"

Ask:

> "Do you prefer a racket that feels very easy and quick to move, or one that feels more solid and stable when hitting hard?"

Instead of:

> "Do you prefer an open string pattern?"

Ask:

> "Do you want easier access to topspin, or do you prefer a more predictable and control-oriented response?"

The Agent should understand technical specifications internally and communicate them in simple language.

---

# 31. Product Data Required

For the recommendation engine to work properly, the product database should ideally contain:

```text
productName
brand
model
price
availability

racketType
playerLevel
recommendedLevel

unstrungWeight
strungWeight

headSize
headSizeCategory

gripSizes

balance
balancePoint

swingweight

length

stringPattern

frameMaterial
frameStiffness
RA

powerLevel
controlLevel
spinPotential
maneuverability
stability
comfort
forgiveness

recommendedPlayingStyles

recommendedPlayerTypes
```

If some attributes are missing, the Agent must not invent them.

---

# 32. Missing Product Data Rule

If the product database does not contain a specification:

**Do not guess it.**

For example:

If swingweight is unknown:

> "Swingweight data is not available, so I won't use it as a ranking factor."

Do not infer exact swingweight from static weight.

Do not infer exact balance from product marketing language.

Do not invent RA values.

Do not invent grip sizes.

---

# 33. Recommendation Philosophy

The recommendation system should optimize for:

**Fit > Marketing**

**Player requirements > Brand**

**Compatibility > Price**

**Technique and physical ability > Professional status**

**Complete racket profile > Single specification**

The best recommendation is not the most expensive racket.

It is not necessarily the lightest racket.

It is not necessarily the heaviest racket.

It is not necessarily the racket with the largest head.

It is the racket whose overall characteristics create the best match for that particular player.

---

# 34. Final Agent Instruction

When making a recommendation, think in this order:

**WHO is the player?**

→ Age
→ Junior/adult
→ Experience
→ Physical ability

**HOW does the player play?**

→ Swing speed
→ Swing style
→ Baseline/all-court/net
→ Power/spin/control

**WHAT does the player need?**

→ Power
→ Control
→ Spin
→ Stability
→ Maneuverability
→ Forgiveness
→ Comfort

**WHAT racket profile satisfies those needs?**

→ Weight
→ Head size
→ Balance
→ Swingweight
→ String pattern
→ Length
→ Stiffness

**WHICH available product matches that profile best?**

→ Filter
→ Score
→ Rank
→ Explain trade-offs

Never skip directly from:

> "Beginner"

to:

> "Buy this racket."

The system must first understand the player, build a target racket profile, and then select the product.

That is the core logic of the recommendation engine.
