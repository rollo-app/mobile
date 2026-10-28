import { router } from "expo-router";
import { ActivityIndicator, FlatList } from "react-native";
import { formatAgo } from "@/features/comments/relative-time";
import { useMediaToken } from "@/features/media/revealed";
import { Avatar } from "@/features/profile/avatar";
import { Button, ErrorText, Footnote, Loading, Screen } from "@/ui/components";
import { ActivityRow, ActivityThumb } from "./activity-row";
import { featuredByHref } from "./activity-targets";
import { useFeaturedBy } from "./use-featured-by";

/** Destacaron tus fotos: who put one of your photos on their profile, newest first. Tap one to open it there. */
export function FeaturedByScreen() {
  const { items, error, loading, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeaturedBy();
  // Read only once there's something to load.
  const token = useMediaToken(items && items.length > 0 ? "featured-by" : undefined);

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
        <Footnote>Nadie destacó tus fotos todavía.</Footnote>
      </Screen>
    );
  }
  return (
    <FlatList
      testID="featured-by-list"
      data={items}
      keyExtractor={(i) => `${i.user.id}:${i.mediaId}`}
      contentInsetAdjustmentBehavior="automatic"
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} /> : undefined}
      renderItem={({ item }) => (
        <ActivityRow
          label={`${item.user.name} destacó tu foto, ${formatAgo(item.featuredAt)}`}
          leading={<Avatar id={item.user.id} name={item.user.name} avatarUrl={item.user.avatarUrl} size={40} />}
          title={`${item.user.name} destacó tu foto`}
          titleLines={2}
          detail={formatAgo(item.featuredAt)}
          trailing={<ActivityThumb path={item.thumbPath} hash={item.thumbHash} token={token} id={item.mediaId} />}
          onPress={() => router.push(featuredByHref(item))}
        />
      )}
    />
  );
}
