// TGJU's public website feed, not a contracted API. Keep its schema isolated here.
export const TGJU_RATES_URL = "https://call1.tgju.org/ajax.json";
export const MAX_RATE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const RATE_DELAY_MS = 30 * 60 * 1000;

function parseQuote(quote, now) {
  const raw = quote?.p;
  if (typeof raw !== "string" && typeof raw !== "number") {
    throw new Error("Missing TGJU price");
  }
  const normalized = String(raw).trim()
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
  if (!/^(?:\d+|\d{1,3}(?:[,٬]\d{3})+)(?:\.\d+)?$/.test(normalized)) {
    throw new Error("Invalid TGJU price");
  }
  const rial = Number(normalized.replace(/[,٬]/g, ""));
  if (!Number.isFinite(rial) || rial <= 0) throw new Error("Invalid TGJU price");

  // The feed's ts field is Gregorian local time in Tehran.
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(quote?.ts ?? "")) {
    throw new Error("Missing TGJU timestamp");
  }
  const timestamp = Date.parse(`${quote.ts.replace(" ", "T")}+03:30`);
  if (!Number.isFinite(timestamp) || timestamp > now + 5 * 60 * 1000 || now - timestamp > MAX_RATE_AGE_MS) {
    throw new Error("Invalid or expired TGJU timestamp");
  }
  return { price: rial / 10, timestamp };
}

export function parseMarketRates(data, now = Date.now()) {
  const usd = parseQuote(data?.current?.price_dollar_rl, now);
  const eur = parseQuote(data?.current?.price_eur, now);
  return {
    usd: usd.price,
    eur: eur.price,
    unit: "toman",
    source: "TGJU",
    updatedAt: new Date(Math.min(usd.timestamp, eur.timestamp)).toISOString(),
    fetchedAt: new Date(now).toISOString(),
  };
}

export function getMarketRatesStatus(rates, now = Date.now()) {
  const age = now - Date.parse(rates.updatedAt);
  const fetchAge = now - Date.parse(rates.fetchedAt);
  if (!Number.isFinite(age) || !Number.isFinite(fetchAge) || age > MAX_RATE_AGE_MS) {
    throw new Error("Market rates expired");
  }
  return { ...rates, stale: age > RATE_DELAY_MS || fetchAge > RATE_DELAY_MS };
}

export async function fetchMarketRates(fetcher = fetch) {
  const response = await fetcher(TGJU_RATES_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`TGJU HTTP ${response.status}`);
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("TGJU returned a non-JSON response");
  }
  return parseMarketRates(await response.json());
}
