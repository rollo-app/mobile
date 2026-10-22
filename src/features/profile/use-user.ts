import { useQuery } from "@tanstack/react-query";
import { fetchUser } from "./actions";

export const userKey = (userId: string) => ["user", userId] as const;

/**
 * Someone's profile: name, @ and photo always; bio only if `canSee`. `profile` is the latest known
 * data even if stale; `error` appears only if there's no data at all.
 */
export function useUser(userId: string | undefined) {
  const query = useQuery({
    queryKey: userKey(userId ?? ""),
    queryFn: () => fetchUser(userId!),
    enabled: !!userId,
  });
  const profile = query.data ?? null;
  return {
    profile,
    error: profile ? null : query.isError ? (query.error instanceof Error ? query.error.message : "No se pudo cargar el perfil") : null,
    loading: !profile && query.isPending && !!userId,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
