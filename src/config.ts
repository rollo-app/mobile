import Constants from "expo-constants";

/**
 * URL del backend. Para desarrollar contra el Worker local:
 *   EXPO_PUBLIC_API_URL=http://<ip-de-tu-mac>:8787 npm start
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "https://rollo-api.juanifraga.com";
