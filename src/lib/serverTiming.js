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
}));

// Calls work synchronously, so wrapping a read never changes when it starts or what it rejects with.
export function timed(name, work) {
  const timing = requestTiming();
  const startedAt = performance.now();
  const promise = Promise.resolve(work());
  const record = () => {
    timing.steps[name] = {
      start: Math.round(startedAt - timing.start),
      ms: Math.round(performance.now() - startedAt),
    };
  };
  promise.then(record, record);
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
