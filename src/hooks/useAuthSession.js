"use client";

import useSWR from "swr";

async function fetchSession(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("بررسی وضعیت ورود انجام نشد");
  return response.json();
}

// Shared even outside UserProvider (e.g. dashboard wishlist). localStorage is
// only a display hint and never authorizes a private request.
export default function useAuthSession() {
  return useSWR("/api/auth/session", fetchSession, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
}
