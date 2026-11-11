// Persistent lightweight dispatcher. Execution stays inside Next so aliases,
// audit hooks, cache invalidation and server-only modules behave identically.
import { setTimeout as sleep } from "node:timers/promises";
try { process.loadEnvFile(".env"); } catch { /* deployment may inject env */ }
const origin = process.env.PRODUCT_JOBS_BASE_URL || process.env.MCP_PUBLIC_ORIGIN;
const token = process.env.PRODUCT_JOBS_WORKER_SECRET;
if (!origin || !token) throw new Error("PRODUCT_JOBS_BASE_URL and PRODUCT_JOBS_WORKER_SECRET are required");
const endpoint = new URL("/api/internal/product-jobs", origin);
if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(endpoint.hostname)) throw new Error("Worker origin must use HTTPS");
if (endpoint.username || endpoint.password) throw new Error("Worker origin must not contain credentials");
function interval(key, fallback) {
  const value = Number(process.env[key] || fallback);
  if (!Number.isInteger(value) || value < 1000 || value > 60000) throw new Error(`Invalid ${key}: expected 1000..60000 milliseconds`);
  return value;
}
const idleDelay = interval("PRODUCT_JOBS_POLL_INTERVAL_MS", 15000);
const errorDelay = interval("PRODUCT_JOBS_ERROR_INTERVAL_MS", 15000);
let stopping = false;
const sleepController = new AbortController();
const stop = () => {
  stopping = true;
  sleepController.abort();
  // Let the in-flight stage finish (190s maximum). Vercel gives us 210s.
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
console.log("Product job dispatcher started");
while (!stopping) {
  let delay = idleDelay;
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` },
      redirect: "error", signal: AbortSignal.timeout(190000) });
    if (!response.ok) {
      console.error("Product worker HTTP status", response.status);
      delay = errorDelay;
    } else {
      const result = await response.json();
      if (!result.idle) { console.log("Processed product job stage", result.jobId); delay = 250; }
    }
  } catch { console.error("Product worker connection failed"); delay = errorDelay; }
  if (!stopping) await sleep(delay, undefined, { signal: sleepController.signal }).catch(error => {
    if (error.name !== "AbortError") throw error;
  });
}
console.log("Product job dispatcher stopped cleanly");
