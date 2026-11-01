"use client";

import { useEffect } from "react";

// Error/404 pages may insert the inline loader through innerHTML, whose script
// does not execute. Hydration itself is sufficient to dismiss this fallback;
// do not wait for images, window.load, or the rest of a streamed document.
export default function InitialLoadLoaderDismiss() {
  useEffect(() => {
    document.documentElement.setAttribute("data-tnd-il-done", "");
  }, []);

  return null;
}
