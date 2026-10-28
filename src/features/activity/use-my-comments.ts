import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { errorMessage } from "@/api/client";
import { fetchMyComments } from "./actions";

export const myCommentsKey = ["my-comments"] as const;

/** Your comments, paged by the server's cursor. Keeps the last known data if a refetch fails; `error` only when there is nothing to show. */
export function useMyComments() {
  const query = useInfiniteQuery({
    queryKey: myCommentsKey,
    queryFn: ({ pageParam }) => fetchMyComments(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? null, [query.data]);
  return {
    items,
    total: query.data?.pages[0]?.total ?? null,
    error: items ? null : query.isError ? errorMessage(query.error, "No se pudieron cargar tus comentarios") : null,
    loading: !items && query.isPending,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
