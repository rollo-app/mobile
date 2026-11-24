import { useRouter } from "expo-router";
import { useEffect } from "react";
import { hasSeenContestWinner, markContestWinnerSeen } from "@/storage/contest-winner-seen";
import type { Contest } from "./actions";

// Trips whose check is in flight: the card and the contest screen can mount at the same time, and the
// keychain read is async, so without this both would see "unseen" and open it twice.
const checking = new Set<string>();

/**
 * Opens the winner reveal (`/contest-winner`) the first time this phone sees the contest closed with a winner,
 * once per event (`rollo.contestWinnerSeen.<tripId>`). It's marked as seen as it opens, so closing it midway
 * doesn't bring it back. Mounted by `ContestCard` and `ContestScreen`.
 */
export function useWinnerReveal(tripId: string | undefined, contest: Pick<Contest, "status" | "winner"> | null | undefined) {
  const router = useRouter();
  const due = !!tripId && contest?.status === "closed" && !!contest.winner;

  useEffect(() => {
    if (!due || !tripId || checking.has(tripId)) return;
    checking.add(tripId);
    void (async () => {
      try {
        if (await hasSeenContestWinner(tripId)) return;
        await markContestWinnerSeen(tripId);
        router.push(`/contest-winner?trip=${tripId}`);
      } catch {
        // The keychain failed: no reveal this time, the results are there anyway.
      } finally {
        checking.delete(tripId);
      }
    })();
  }, [due, tripId]); // eslint-disable-line react-hooks/exhaustive-deps
}
