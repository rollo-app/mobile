import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect } from "react";
import { PushPrimer } from "@/features/notifications/push-primer";

/**
 * "¿Te avisamos…?" sheet, once, after creating or joining a roll; then the sheet in `next`, if any.
 * `next` opens when the sheet goes away however it closes: its buttons or a swipe down.
 */
export default function PushPrimerRoute() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  useEffect(
    () => () => {
      if (next?.startsWith("/") && !next.startsWith("//")) router.push(next as Href);
    },
    [next],
  );
  return <PushPrimer onDone={() => router.back()} />;
}
