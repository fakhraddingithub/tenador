// Shared by next.config.mjs (which tags the responses) and src/lib/revalidate.js
// (which purges them), so the two can never drift. Plain module, no imports.
//
// Every page under /[sport]/… is cached at Vercel's CDN for an hour via
// Vercel-CDN-Cache-Control. Those routes are force-dynamic, so Next attaches no
// path tags and revalidatePath() cannot reach that CDN copy; a CDN entry can only
// be purged by a tag it carries. A constant ASCII tag is used on purpose: a
// path-derived tag would put Persian slugs into a response header (ERR_INVALID_CHAR).
export const SPORT_PAGES_CDN_TAG = "storefront-sport-pages";
