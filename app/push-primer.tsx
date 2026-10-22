import { router, useLocalSearchParams, type Href } from "expo-router";
import { PushPrimer } from "@/features/notifications/push-primer";

/** "¿Te avisamos…?" sheet, once, after creating or joining a roll; then the sheet in `next`, if any. */
export default function PushPrimerRoute() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  return (
    <PushPrimer
      onDone={() => {
        router.back();
        if (next?.startsWith("/") && !next.startsWith("//")) router.push(next as Href);
      }}
    />
  );
}
