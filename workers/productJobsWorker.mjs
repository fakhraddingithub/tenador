// Persistent lightweight dispatcher. Execution stays inside Next so aliases,
// audit hooks, cache invalidation and server-only modules behave identically.
try { process.loadEnvFile(".env"); } catch { /* deployment may inject env */ }
const origin = process.env.PRODUCT_JOBS_BASE_URL || process.env.MCP_PUBLIC_ORIGIN;
const token = process.env.PRODUCT_JOBS_WORKER_SECRET;
if (!origin || !token) throw new Error("PRODUCT_JOBS_BASE_URL and PRODUCT_JOBS_WORKER_SECRET are required");
const endpoint = new URL("/api/internal/product-jobs", origin);
if (endpoint.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(endpoint.hostname)) throw new Error("Worker origin must use HTTPS");
let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
console.log("Product job dispatcher started");
while (!stopping) {
  let delay = 3000;
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` },
      redirect: "error", signal: AbortSignal.timeout(190000) });
    if (!response.ok) {
      console.error("Product worker HTTP status", response.status);
      delay = 15000;
    } else {
      const result = await response.json();
      if (!result.idle) { console.log("Processed product job stage", result.jobId); delay = 250; }
    }
  } catch { console.error("Product worker connection failed"); delay = 15000; }
  if (!stopping) await new Promise(resolve => setTimeout(resolve, delay));
}
