import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { errorMessage } from "@/api/client";
import { fetchMyLikes } from "./actions";

export const myLikesKey = ["my-likes"] as const;

/**
 * The photos you liked, paged by the server's cursor. `photos` and `total` keep the last known data
 * even if a refetch fails; `error` appears only when there is nothing to show.
 */
export function useMyLikes() {
  const query = useInfiniteQuery({
    queryKey: myLikesKey,
    queryFn: ({ pageParam }) => fetchMyLikes(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const photos = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? null, [query.data]);
  const total = query.data?.pages[0]?.total ?? null;
  return {
    photos,
    total,
    error: photos ? null : query.isError ? errorMessage(query.error, "No se pudieron cargar tus me gusta") : null,
    loading: !photos && query.isPending,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
