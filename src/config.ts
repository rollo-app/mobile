import Constants from "expo-constants";

/**
 * Backend URL. To develop against the local Worker:
 *   EXPO_PUBLIC_API_URL=http://<your-mac-ip>:8787 npm start
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "https://rollo-api.juanifraga.com";

/** EAS project, needed to get an Expo push token. */
export const EAS_PROJECT_ID: string =
  ((Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? Constants.easConfig?.projectId) ??
  "124fc671-d309-4a16-9606-e4e900286752";

/**
 * Google Sign-In (Google Cloud project rollo-514415). The ID token is asked for the web client, the audience the backend
 * checks; each build signs in with the iOS client of its bundle id. Client ids are public.
 */
export const GOOGLE_WEB_CLIENT_ID = "331161321522-jlgfn8q6egq5oe4l3n358vr24d3gh6mv.apps.googleusercontent.com";
export const GOOGLE_IOS_CLIENT_IDS = {
  production: "331161321522-eg16sji80rga1jor4b5k8ebhs4tc750f.apps.googleusercontent.com",
  development: "331161321522-22bg1d28fj30lnliseebuit2v7bc5lcm.apps.googleusercontent.com",
} as const;

/** The production build is `com.juanifraga.rollo.app`; anything else is the development one. */
export function googleIosClientId(bundleId: string | undefined): string {
  return bundleId === "com.juanifraga.rollo.app" ? GOOGLE_IOS_CLIENT_IDS.production : GOOGLE_IOS_CLIENT_IDS.development;
}

/** Public site with the terms and the privacy policy. */
export const SITE_URL = "https://rollo.juanifraga.com";
