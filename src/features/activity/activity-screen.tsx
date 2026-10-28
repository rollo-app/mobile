import { router } from "expo-router";
import { Row, Screen, Section } from "@/ui/components";
import { useFeaturedBy } from "./use-featured-by";
import { useMyComments } from "./use-my-comments";
import { useMyLikes } from "./use-my-likes";

const count = (total: number | null) => (total === null ? undefined : String(total));

/** Tu actividad: only you see it. The photos you liked, what you commented and who featured your photos, each with its count. */
export function ActivityScreen() {
  const likes = useMyLikes();
  const comments = useMyComments();
  const featuredBy = useFeaturedBy();
  return (
    <Screen grouped>
      <Section>
        <Row label="Me gusta" value={count(likes.total)} onPress={() => router.push("/me/likes")} />
        <Row label="Comentarios" value={count(comments.total)} onPress={() => router.push("/me/comments")} />
        <Row label="Destacaron tus fotos" value={count(featuredBy.total)} onPress={() => router.push("/me/featured-by")} />
      </Section>
    </Screen>
  );
}
