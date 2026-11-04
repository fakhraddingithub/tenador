import { cache } from "react";
import mongoose from "mongoose";

// A server component cannot set response headers, so the page prints these numbers as JSON
// instead of a Server-Timing header. Durations only: no user or product data.
// ponytail: diagnostic for the product page TTFB, remove once that investigation is done.

// cache() scopes this to one request, so the layout and the page share the same store.
const requestTiming = cache(() => ({
  start: performance.now(),
  dbAtStart: mongoose.connection.readyState,
  steps: {},
  pending: [],
}));

// Calls work synchronously, so wrapping a read never changes when it starts or what it rejects with.
// A second call under the same name gets its own entry (name#2), so duplicate reads stay visible.
export function timed(name, work) {
  const timing = requestTiming();
  const startedAt = performance.now();
  let key = name;
  for (let n = 2; timing.steps[key]; n++) key = `${name}#${n}`;
  const step = { start: Math.round(startedAt - timing.start), ms: null };
  timing.steps[key] = step;
  const promise = Promise.resolve(work());
  const record = () => { step.ms = Math.round(performance.now() - startedAt); };
  timing.pending.push(promise.then(record, record));
  return promise;
}

export function readServerTiming() {
  const timing = requestTiming();
  return {
    totalMs: Math.round(performance.now() - timing.start),
    instanceAgeSec: Math.round(process.uptime()),
    // mongoose readyState when this request began: 1 = connected, 0 = had to connect
    dbAtStart: timing.dbAtStart,
    steps: timing.steps,
  };
}

// Streamed after the shell, so waiting for slower steps here does not delay the page.
export async function ServerTimingLate() {
  await Promise.all(requestTiming().pending);
  return (
    <script
      type="application/json"
      id="server-timing-late"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(readServerTiming()) }}
    />
  );
}
