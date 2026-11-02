import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { errorMessage } from "@/api/client";
import { searchUsers } from "./actions";
import { SEARCH_MIN, searchQuery } from "./search-text";

export const userSearchKey = (q: string) => ["user-search", q] as const;

const DEBOUNCE_MS = 300;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/** Searches people by @username or name; waits for a pause in typing and for 2+ characters. */
export function useUserSearch(raw: string) {
  const query = useDebouncedValue(searchQuery(raw), DEBOUNCE_MS);
  const enabled = query.length >= SEARCH_MIN;
  const result = useQuery({
    queryKey: userSearchKey(query),
    queryFn: () => searchUsers(query),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  return {
    query,
    results: enabled ? (result.data ?? null) : null,
    loading: enabled && result.isPending,
    error: result.isError ? errorMessage(result.error, "No se pudo buscar") : null,
    refetch: result.refetch,
    isRefetching: result.isRefetching,
    /** True while `results` still belong to an older query (the next one is loading). */
    isPlaceholderData: result.isPlaceholderData,
  };
}
