import { useEffect, useState } from "react";
import { checkUsername } from "./actions";
import { normalizeUsername, usernameError } from "./username";

export type UsernameStatus =
  | { kind: "unchanged" }
  | { kind: "invalid"; message: string }
  | { kind: "checking" }
  | { kind: "taken" }
  | { kind: "available" }
  /** The check couldn't run (no signal): saving is allowed and the server decides. */
  | { kind: "unknown" };

export const USERNAME_DEBOUNCE_MS = 400;
export const USERNAME_TAKEN = "Ese nombre de usuario ya está en uso.";

type Result = { value: string; outcome: "available" | "taken" | "unknown" };

/**
 * Live status of the username being typed: instant local validation, then a debounced availability
 * check against the server. Your current username counts as unchanged (no request).
 */
export function useUsernameStatus(value: string, current: string | null): UsernameStatus {
  const normalized = normalizeUsername(value);
  const [result, setResult] = useState<Result | null>(null);

  const invalid = usernameError(normalized);
  const unchanged = normalized === current;
  const needsCheck = !invalid && !unchanged;

  useEffect(() => {
    if (!needsCheck) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkUsername(normalized)
        .then((r) => !cancelled && setResult({ value: normalized, outcome: r.available ? "available" : "taken" }))
        .catch(() => !cancelled && setResult({ value: normalized, outcome: "unknown" }));
    }, USERNAME_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needsCheck, normalized]);

  if (invalid) return { kind: "invalid", message: invalid };
  if (unchanged) return { kind: "unchanged" };
  if (result?.value !== normalized) return { kind: "checking" };
  return { kind: result.outcome };
}
