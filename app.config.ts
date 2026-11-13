import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the whole config; this only switches what differs between the two builds.
// - development (default): `npx expo run:ios --device` signed with the free Personal Team, which
//   already owns `com.juanifraga.rollo` and can't sign the Push Notifications capability.
// - production (`APP_VARIANT=production`, set by eas.json): EAS builds for TestFlight/App Store,
//   signed with the paid team that registered `com.juanifraga.rollo.app`, with push.
// Being a function keeps app.json writable by tools like `eas init`.

// Strips `aps-environment` (added by expo-notifications). It must be the FIRST plugin: mods run in
// reverse order, so it runs after expo-notifications.
const WITHOUT_PUSH = "./plugins/without-push-entitlement";

const GOOGLE_URL_SCHEME = {
  production: "com.googleusercontent.apps.331161321522-eg16sji80rga1jor4b5k8ebhs4tc750f",
  development: "com.googleusercontent.apps.331161321522-22bg1d28fj30lnliseebuit2v7bc5lcm",
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const isProduction = process.env.APP_VARIANT === "production";
  return {
    ...config,
    name: isProduction ? "Rollo" : "Rollo Dev",
    slug: config.slug ?? "rollo",
    ios: {
      ...config.ios,
      // Universal Links (the email's magic link and friend links). The free Personal Team can't sign
      // Associated Domains, so only the production build asks for it.
      ...(isProduction ? { associatedDomains: ["applinks:rolloproject.com"] } : {}),
      // Sign in with Apple: same story, the free Personal Team can't sign the capability (the dev build hides the button).
      ...(isProduction ? { usesAppleSignIn: true } : {}),
      bundleIdentifier: isProduction ? "com.juanifraga.rollo.app" : "com.juanifraga.rollo",
    },
    plugins: [
      ...(isProduction ? (config.plugins ?? []) : [WITHOUT_PUSH, ...(config.plugins ?? [])]),
      // Google Sign-In returns to the app through the reversed iOS client id of each build (see GOOGLE_IOS_CLIENT_IDS in src/config.ts).
      ["@react-native-google-signin/google-signin", { iosUrlScheme: isProduction ? GOOGLE_URL_SCHEME.production : GOOGLE_URL_SCHEME.development }],
    ],
  };
};
