import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { getSession } from "@/features/auth/session";
import { setActiveTripId } from "@/storage/active-trip";
import { tripIdFromResponse } from "./reveal";

/** Tapping the reveal notification makes that roll the active one and goes to its gallery. */
export function useRevealTap() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const tripId = tripIdFromResponse(response ?? null);
    if (!tripId) return;
    // Signed out there is no app to open: the login comes first.
    void getSession().then(async (token) => {
      if (!token) return;
      await setActiveTripId(tripId);
      router.dismissTo("/roll");
    });
  }, [response]);
}
