import { createApiClient, unwrap } from "@/api/client";
import { API_URL } from "@/config";

export const configKey = ["config"] as const;

/** Public switches of the server. No session: it's read before anybody is logged in. */
export async function fetchConfig(): Promise<{ registrationsOpen: boolean }> {
  return unwrap(createApiClient({ baseUrl: API_URL }).GET("/config"));
}

/** Puts the email on the waitlist (the server emails a confirmation). `consent` is what the user ticked. */
export async function joinWaitlist(email: string): Promise<void> {
  await unwrap(
    createApiClient({ baseUrl: API_URL }).POST("/waitlist", {
      body: { email: email.trim().toLowerCase(), source: "app", consent: true },
    }),
  );
}
