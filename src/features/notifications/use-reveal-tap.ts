import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { markOpened } from "@/storage/trips";
import { tripIdFromResponse } from "./reveal";

/** Tapping the reveal notification makes that roll the active one and goes to its gallery. */
export function useRevealTap() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const tripId = tripIdFromResponse(response ?? null);
    if (!tripId) return;
    void markOpened(tripId).then(() => router.dismissTo("/roll"));
  }, [response]);
}
