import { useMemo } from "react";
import { isEvent } from "@/features/events/event";
import { useBlocked } from "@/features/moderation/use-blocked";
import type { StoryCredits } from "./story";

/**
 * Whether the stories of this roll get credits, and with whom filtered out. Events never do (and don't wait). On a
 * regular roll `ready` turns true once the blocked list loaded or failed, so the stories aren't rebuilt under the
 * viewer when it arrives; if it failed there are no credits (when in doubt, nobody is named). `credits` keeps its
 * identity while the blocked ids don't change.
 */
export function useStoryCredits(trip: { type?: "trip" | "event" } | null | undefined): { ready: boolean; credits: StoryCredits | undefined } {
  const { blocked, error } = useBlocked();
  // `Friend.id` is the user id.
  const key = blocked ? blocked.map((f) => f.id).sort().join(",") : null;
  const credits = useMemo<StoryCredits | undefined>(
    () => (key === null ? undefined : { blockedUserIds: new Set(key === "" ? [] : key.split(",")) }),
    [key],
  );
  if (trip && isEvent(trip)) return { ready: true, credits: undefined };
  return { ready: blocked !== null || error !== null, credits };
}
