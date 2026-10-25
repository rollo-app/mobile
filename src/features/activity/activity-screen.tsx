import { router } from "expo-router";
import { Row, Screen, Section } from "@/ui/components";
import { useMyLikes } from "./use-my-likes";

/** Tu actividad: only you see it. A list that grows (your comments, ...); today just the photos you liked. */
export function ActivityScreen() {
  const { total } = useMyLikes();
  return (
    <Screen grouped>
      <Section>
        <Row label="Me gusta" value={total === null ? undefined : String(total)} onPress={() => router.push("/me/likes")} />
      </Section>
    </Screen>
  );
}
