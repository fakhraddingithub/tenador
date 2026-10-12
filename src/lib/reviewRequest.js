// Keep the deadline active while reading the body as well as waiting for headers.
// AbortController + a timer also works in older in-app browsers.
export async function reviewRequest(url, options, { timeoutMs, timeoutMessage }) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        return { response, data };
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(timeoutMessage));
          controller.abort();
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
