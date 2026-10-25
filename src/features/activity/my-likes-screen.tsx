import { router } from "expo-router";
import { ActivityIndicator } from "react-native";
import { useMe } from "@/features/auth/use-me";
import { useMediaToken } from "@/features/media/revealed";
import { Button, ErrorText, Footnote, Loading, Screen } from "@/ui/components";
import { likeHref } from "./likes-target";
import { MyLikesGrid } from "./my-likes-grid";
import { useMyLikes } from "./use-my-likes";

/** Me gusta: the photos you liked, newest like first. Tap one to open it where you can see it today. */
export function MyLikesScreen() {
  const { me } = useMe();
  const { photos, error, loading, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useMyLikes();
  // Read only once there's something to load.
  const token = useMediaToken(photos && photos.length > 0 ? "likes" : undefined);

  if (!photos) {
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
  if (photos.length === 0) {
    return (
      <Screen grouped>
        <Footnote>Todavía no te gustó ninguna foto.</Footnote>
      </Screen>
    );
  }
  return (
    <MyLikesGrid
      photos={photos}
      token={token}
      myId={me?.id}
      onOpen={(photo) => router.push(likeHref(photo))}
      onEnd={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      footer={isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} /> : undefined}
    />
  );
}
