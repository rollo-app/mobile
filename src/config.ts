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

/** Public site with the terms and the privacy policy. */
export const SITE_URL = "https://rollo.juanifraga.com";
