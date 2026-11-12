import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./schema";

/**
 * Typed client generated from the backend contract (openapi.json).
 * If the API changes: `npm run api:generate` and TypeScript flags what needs adjusting.
 */

export type Schemas = components["schemas"];

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** From the `Retry-After` header (delta-seconds), in ms. Undefined if absent or not a valid number of seconds. */
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * What to show under a form for a failed request: the server's message (ApiError), or the screen's
 * own fallback. Null when there's no error, so it can feed `{message && <ErrorText>…}` straight.
 */
export function errorMessage(error: unknown, fallback: string): string | null {
  if (error == null) return null;
  return error instanceof Error ? error.message : fallback;
}

export const OFFLINE_MESSAGE =
  "Sin conexión. Probá de nuevo cuando tengas señal.";

let onUnauthorized: ((token: string) => void) | null = null;

/**
 * Registers who closes the local session when the server rejects it (401). It's a single place:
 * every client made with a token reports there, whatever endpoint it called.
 */
export function setUnauthorizedHandler(
  handler: ((token: string) => void) | null,
) {
  onUnauthorized = handler;
}

export function createApiClient({
  baseUrl,
  token,
}: {
  baseUrl: string;
  token?: string | null;
}) {
  const client = createClient<paths>({ baseUrl });
  if (token) {
    const auth: Middleware = {
      onRequest({ request }) {
        request.headers.set("Authorization", `Bearer ${token}`);
        return request;
      },
      onResponse({ response }) {
        if (response.status === 401) onUnauthorized?.(token);
        return undefined;
      },
    };
    client.use(auth);
  }
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** `Retry-After` as ms. Only delta-seconds are accepted; an HTTP date or garbage is ignored. */
function parseRetryAfter(value: string | null | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value.trim())) return undefined;
  return Number(value.trim()) * 1000;
}

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

/** Returns `data` or throws an ApiError with the server's message (`{ error }`). */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await request;
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
  if (!result.response.ok) {
    const message =
      (result.error as { error?: string } | undefined)?.error ??
      `Error ${result.response.status}`;
    throw new ApiError(
      result.response.status,
      message,
      parseRetryAfter(result.response.headers?.get?.("retry-after")),
    );
  }
  return result.data as T;
}
