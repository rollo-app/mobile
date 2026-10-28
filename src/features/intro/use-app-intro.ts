import { router } from "expo-router";
import { useEffect } from "react";
import { takeAppIntroPending } from "@/storage/app-intro";

// A check in flight: claimed synchronously so overlapping runs of the effect never open the intro twice.
let claiming = false;

/** When a new account just completed its profile (flag queued), opens the full-screen intro once. */
export function useAppIntro() {
  useEffect(() => {
    if (claiming) return;
    claiming = true;
    takeAppIntroPending()
      .then((pending) => {
        if (pending) router.push("/intro");
      })
      .catch(() => {})
      .finally(() => {
        claiming = false;
      });
  }, []);
}
