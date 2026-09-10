import test from "node:test";
import assert from "node:assert/strict";
import { fetchMarketRates, parseMarketRates, getMarketRatesStatus, MAX_RATE_AGE_MS } from "../services/marketRates.js";

const now = Date.parse("2026-09-10T13:35:00Z");
const fixture = () => ({ current: {
  price_eur: { p: "2,747,600", ts: "2026-09-10 16:59:59" },
  unrelated: { p: "999" },
  price_dollar_rl: { p: "2,359,750", ts: "2026-09-10 16:59:57" },
} });

test("selects market symbols, converts rial to toman, and preserves source time", () => {
  const rates = parseMarketRates(fixture(), now);
  assert.equal(rates.usd, 235975);
  assert.equal(rates.eur, 274760);
  assert.equal(rates.unit, "toman");
  assert.equal(rates.updatedAt, "2026-09-10T13:29:57.000Z");
  assert.equal(getMarketRatesStatus(rates, now).stale, false);
});

test("accepts Persian and Arabic numerals and numeric prices", () => {
  const data = fixture();
  data.current.price_dollar_rl.p = "۲٬۳۵۹٬۷۵۰";
  data.current.price_eur.p = "٢٬٧٤٧٬٦٠٠";
  assert.equal(parseMarketRates(data, now).usd, 235975);
  assert.equal(parseMarketRates(data, now).eur, 274760);
  data.current.price_dollar_rl.p = 2359750;
  assert.equal(parseMarketRates(data, now).usd, 235975);
});

test("rejects incomplete payloads and invalid prices instead of returning zero or NaN", () => {
  for (const value of [null, undefined, {}, "", "---", "1,23", "100 تومان", 0, -1, Infinity, true]) {
    const data = fixture();
    data.current.price_eur.p = value;
    assert.throws(() => parseMarketRates(data, now));
  }
  assert.throws(() => parseMarketRates({ error: "unavailable" }, now));
});

test("rejects missing, future and expired source timestamps", () => {
  for (const ts of [undefined, "invalid", "2026-09-11 16:59:57", "2026-09-01 16:59:57"]) {
    const data = fixture();
    data.current.price_dollar_rl.ts = ts;
    assert.throws(() => parseMarketRates(data, now));
  }
});

test("cached data becomes delayed and eventually expires even without a successful refresh", () => {
  const rates = parseMarketRates(fixture(), now);
  assert.equal(getMarketRatesStatus(rates, now + 31 * 60 * 1000).stale, true);
  assert.throws(() => getMarketRatesStatus(rates, now + MAX_RATE_AGE_MS));
});

test("HTTP errors, anti-bot HTML and malformed JSON are not accepted as rates", async () => {
  for (const response of [
    new Response("unavailable", { status: 503 }),
    new Response("<html>Bot Verification</html>", { headers: { "content-type": "text/html" } }),
    new Response("not json", { headers: { "content-type": "application/json" } }),
  ]) {
    await assert.rejects(fetchMarketRates(async () => response));
  }
});

test("network failures propagate so the cache can retain its last valid result", async () => {
  await assert.rejects(fetchMarketRates(async () => { throw new Error("timeout"); }), /timeout/);
});
