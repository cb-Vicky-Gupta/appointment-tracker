import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function unauthorized(message = "Unauthorized") {
  return jsonError(401, message);
}

export function validationError(error: ZodError) {
  return NextResponse.json(
    { error: "Validation failed", issues: error.issues },
    { status: 400 }
  );
}
