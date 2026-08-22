import "server-only";
import { NextResponse } from "next/server";

export function apiError(operation: string, error: unknown, publicMessage = "操作失敗，請稍後再試。", status = 500) {
  const errorId = crypto.randomUUID();
  console.error(`[${errorId}] ${operation}`, error);
  return NextResponse.json({ error: publicMessage, errorId }, { status });
}
