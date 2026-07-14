import { NextResponse } from "next/server";

export function articleApiError(error, context) {
  console.error(context, error);
  if (error?.code === 11000) {
    return NextResponse.json(
      { error: "A record with this slug already exists", code: "SLUG_CONFLICT" },
      { status: 409 },
    );
  }
  if (error?.name === "ValidationError") {
    const details = Object.fromEntries(
      Object.entries(error.errors || {}).map(([key, value]) => [key, value.message]),
    );
    return NextResponse.json({ error: "Validation failed", code: "VALIDATION_ERROR", details }, { status: 400 });
  }
  if (error?.name === "VersionError") {
    return NextResponse.json(
      { error: "The article was modified by another request", code: "EDIT_CONFLICT" },
      { status: 409 },
    );
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function validationResponse(result) {
  return NextResponse.json(
    { error: "Validation failed", code: "VALIDATION_ERROR", details: result.errors },
    { status: 400 },
  );
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
