import { useQuery } from "@tanstack/react-query";
import { fetchFeatured } from "./actions";

export const featuredKey = (userId: string) => ["featured", userId] as const;

/**
 * A user's featured photos. `photos` is the latest known data even if stale; `error` appears only
 * if there's no data at all (e.g. "Este perfil es privado").
 */
export function useFeatured(userId: string | undefined) {
  const query = useQuery({
    queryKey: featuredKey(userId ?? ""),
    queryFn: () => fetchFeatured(userId!),
    enabled: !!userId,
  });
  const photos = query.data ?? null;
  return {
    photos,
    error: photos ? null : query.isError ? (query.error instanceof Error ? query.error.message : "No se pudieron cargar las fotos") : null,
    loading: !photos && query.isPending && !!userId,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
