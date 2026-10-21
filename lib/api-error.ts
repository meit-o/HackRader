import { NextResponse } from "next/server";

const DB_HINTS: Record<string, string> = {
  "42P01": "A required PostgreSQL table is missing. Check the TypeORM migration and /api/health.",
  "42703": "A PostgreSQL column is missing. Check that pending TypeORM migrations have run.",
  "23503": "A related record could not be found. Refresh your session and try again.",
  "23505": "This value is already in use.",
  "23514": "The submitted values do not satisfy a database constraint.",
  "22P02": "An identifier or value has an invalid format. Refresh the page and try again."
};

function describeError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string; driverError?: { code?: string; message?: string } };
    return { message: withCode.driverError?.message ?? error.message, code: withCode.code ?? withCode.driverError?.code };
  }
  if (error && typeof error === "object") {
    const source = error as { message?: unknown; code?: unknown; driverError?: { code?: unknown; message?: unknown } };
    const message = typeof source.driverError?.message === "string" ? source.driverError.message : source.message;
    return {
      message: typeof message === "string" && message ? message : fallback,
      code: typeof source.code === "string" ? source.code : typeof source.driverError?.code === "string" ? source.driverError.code : undefined
    };
  }
  return { message: fallback, code: undefined as string | undefined };
}

export function apiFailure(scope: string, error: unknown, fallback: string) {
  const { message, code } = describeError(error, fallback);
  const hint = code ? DB_HINTS[code] : undefined;
  const resolved = hint ? `${hint} (${code}: ${message})` : message;
  console.error(`[${scope}]`, code ?? "-", message, error);
  return NextResponse.json({ error: resolved, code }, { status: 400 });
}
