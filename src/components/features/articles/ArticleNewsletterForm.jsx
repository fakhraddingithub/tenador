"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function ArticleNewsletterForm({ buttonLabel = "عضویت" }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ثبت ایمیل انجام نشد");
      setState("success");
      setEmail("");
      setMessage("عضویت شما با موفقیت ثبت شد.");
    } catch (error) {
      setState("error");
      setMessage(error.message);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
      <Input type="email" name="email" autoComplete="email" aria-label="Email address" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ایمیل خود را وارد کنید" required className="bg-white text-gray-900" />
      <Button type="submit" disabled={state === "loading"} className="shrink-0 px-8">
        {state === "loading" ? "در حال ثبت..." : buttonLabel}
      </Button>
      <span role="status" className={`self-center text-xs ${state === "error" ? "text-red-300" : "text-green-300"}`} aria-live="polite">{message}</span>
    </form>
  );
}

