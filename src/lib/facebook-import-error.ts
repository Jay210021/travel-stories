type ErrorDetails = {
  provider?: "facebook" | "supabase";
  operation?: string;
  httpStatus?: number;
  graphApiVersion?: string;
  graphResponseBody?: unknown;
  facebookErrorMessage?: string;
  facebookErrorCode?: number;
  facebookErrorSubcode?: number;
  supabaseError?: unknown;
};

export function redactFacebookImportSecrets(value: string): string {
  let redacted = value;
  for (const name of ["FACEBOOK_PAGE_ACCESS_TOKEN", "FACEBOOK_APP_SECRET", "FACEBOOK_WEBHOOK_VERIFY_TOKEN", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    const secret = process.env[name]?.trim();
    if (secret) {
      redacted = redacted.split(secret).join("[redacted]");
      redacted = redacted.split(encodeURIComponent(secret)).join("[redacted]");
    }
  }
  return redacted
    .replace(/((?:access_token|appsecret_proof|token|secret)\s*[=:]\s*)[^\s&"',}]+/gi, "$1[redacted]")
    .replace(/("(?:access_token|appsecret_proof|token|secret|authorization)"\s*:\s*")[^"]*/gi, "$1[redacted]")
    .replace(/Bearer\s+[^\s"',}]+/gi, "Bearer [redacted]");
}

function object(error: unknown): Record<string, unknown> {
  return error !== null && typeof error === "object" ? error as Record<string, unknown> : {};
}

function serialize(value: unknown): string {
  const ancestors: object[] = [];
  return JSON.stringify(value, function (_key, item: unknown) {
    if (typeof item === "bigint") return item.toString();
    if (item !== null && typeof item === "object") {
      while (ancestors.length && ancestors.at(-1) !== this) ancestors.pop();
      if (ancestors.includes(item)) return "[circular]";
      ancestors.push(item);
    }
    return item;
  }) ?? String(value);
}

export function facebookImportErrorReason(error: unknown): string {
  const source = object(error);
  const message = typeof source.message === "string" && source.message ? source.message
    : typeof error === "string" ? error : serialize(error);
  const code = source.code ? ` [${source.code}]` : "";
  return redactFacebookImportSecrets(`${message}${code}`).slice(0, 1000);
}

export class FacebookImportError extends Error {
  readonly details: ErrorDetails;
  constructor(message: string, details: ErrorDetails, cause?: unknown) {
    super(redactFacebookImportSecrets(message), { cause });
    this.name = "FacebookImportError";
    this.details = details;
  }
}

export function isFacebookAuthorizationError(error: unknown): boolean {
  return error instanceof FacebookImportError && error.details.provider === "facebook"
    && [10, 190, 200].includes(error.details.facebookErrorCode ?? 0);
}

export function facebookImportErrorDetails(error: unknown, depth = 0): Record<string, unknown> {
  const source = object(error);
  const details = error instanceof FacebookImportError ? error.details : {};
  const output = {
    name: source.name, message: facebookImportErrorReason(error), stack: source.stack,
    code: source.code, details: source.details, hint: source.hint, ...details,
    ...(source.cause && depth < 4 ? { cause: facebookImportErrorDetails(source.cause, depth + 1) } : {}),
  };
  return JSON.parse(redactFacebookImportSecrets(serialize(output)));
}

export function logFacebookImportError(operation: string, error: unknown, context: Record<string, unknown> = {}) {
  console.error("Facebook import failed", {
    ...JSON.parse(redactFacebookImportSecrets(serialize(context))),
    ...facebookImportErrorDetails(error), stage: operation,
  });
}

export async function facebookSupabaseOperation<T extends { error: unknown; status?: number }>(operation: string, query: PromiseLike<T>): Promise<T> {
  let result: T;
  try { result = await query; }
  catch (error) {
    throw new FacebookImportError(`Supabase ${operation}: ${facebookImportErrorReason(error)}`, { provider: "supabase", operation, supabaseError: facebookImportErrorDetails(error) }, error);
  }
  if (result.error) {
    const errorStatus = object(result.error).statusCode ?? object(result.error).status;
    const httpStatus = result.status ?? (Number.isFinite(Number(errorStatus)) ? Number(errorStatus) : undefined);
    throw new FacebookImportError(`Supabase ${operation} (HTTP ${httpStatus ?? "unknown"}): ${facebookImportErrorReason(result.error)}`, {
      provider: "supabase", operation, httpStatus, supabaseError: result.error,
    }, result.error);
  }
  return result;
}

export async function preserveFacebookImportFailure(error: unknown, recordFailure: () => Promise<unknown>) {
  try { await recordFailure(); }
  catch (recordingError) { logFacebookImportError("record_failure", recordingError, { originalError: facebookImportErrorDetails(error) }); }
}
