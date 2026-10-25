import { useQuery } from "@tanstack/react-query";
import { fetchComments } from "./actions";

export const commentsKey = (mediaId: string) => ["comments", mediaId] as const;

/** The comments of a photo. `error` appears only if there's nothing to show (old comments stay on a failed refetch). */
export function useComments(mediaId: string) {
  const query = useQuery({ queryKey: commentsKey(mediaId), queryFn: () => fetchComments(mediaId) });
  return {
    comments: query.data,
    error: query.data ? null : query.isError ? (query.error instanceof Error ? query.error.message : "No se pudieron cargar los comentarios") : null,
    loading: query.isPending,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
