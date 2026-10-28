import { router } from "expo-router";
import { ActivityIndicator, FlatList } from "react-native";
import { formatAgo } from "@/features/comments/relative-time";
import { useMediaToken } from "@/features/media/revealed";
import { Button, ErrorText, Footnote, Loading, Screen } from "@/ui/components";
import { ActivityRow, ActivityThumb } from "./activity-row";
import { commentHref } from "./activity-targets";
import { useMyComments } from "./use-my-comments";

/** Comentarios: what you commented, newest first. Tap one to open its photo with the comments open. */
export function MyCommentsScreen() {
  const { items, error, loading, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useMyComments();
  // Read only once there's something to load.
  const token = useMediaToken(items && items.length > 0 ? "comments" : undefined);

  if (!items) {
    return (
      <Screen grouped>
        {error && (
          <>
            <ErrorText>{error}</ErrorText>
            <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
          </>
        )}
        {loading && <Loading />}
      </Screen>
    );
  }
  if (items.length === 0) {
    return (
      <Screen grouped>
        <Footnote>Todavía no comentaste ninguna foto.</Footnote>
      </Screen>
    );
  }
  return (
    <FlatList
      testID="my-comments-list"
      data={items}
      keyExtractor={(c) => c.commentId}
      contentInsetAdjustmentBehavior="automatic"
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} /> : undefined}
      renderItem={({ item }) => (
        <ActivityRow
          label={`${item.text}, ${formatAgo(item.createdAt)}`}
          leading={<ActivityThumb path={item.thumbPath} hash={item.thumbHash} token={token} id={item.mediaId} />}
          title={item.text}
          titleLines={2}
          detail={formatAgo(item.createdAt)}
          onPress={() => router.push(commentHref(item))}
        />
      )}
    />
  );
}
