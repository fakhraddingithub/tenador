"use client";

import { useEffect } from "react";

export default function MicrosoftClarity() {
  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim();

    if (process.env.NODE_ENV !== "production" || !projectId) return;

    let cancelled = false;

    // Load analytics after hydration, once per document (including soft navigation).
    import("@microsoft/clarity")
      .then(({ default: Clarity }) => {
        if (!cancelled && !window.clarity) {
          Clarity.init(projectId);
        }
      })
      .catch((error) => {
        console.warn("Microsoft Clarity could not be initialized.", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
