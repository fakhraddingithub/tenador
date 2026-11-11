import { AiError } from "../ai/errors.js";

export function describeJobError(error, stage) {
  if (error instanceof AiError) {
    // AiError messages are locally authored and sanitized by the provider layer.
    const retryable = /(?:TIMEOUT|UNREACHABLE|SERVICE_UNAVAILABLE|QUOTA|INCOMPLETE|EMPTY|INVALID_JSON)$/.test(error.code);
    return { code: error.code, message: error.message, retryable };
  }
  if (error.jobPublic) return { code: "JOB_VALIDATION", message: error.message, retryable: false };
  return {
    code: "JOB_STAGE_FAILED", retryable: true,
    message: ["analyse", "review", "revise"].includes(stage)
      ? "اجرای مرحلهٔ تحلیل یا نگارش کامل نشد؛ لاگ همین مرحله در سرور را بررسی کنید."
      : "اجرای مرحله کامل نشد؛ لاگ همین مرحله در سرور را بررسی کنید.",
  };
}
