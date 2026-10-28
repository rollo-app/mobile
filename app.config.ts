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
      ...(isProduction ? { associatedDomains: ["applinks:rollo.juanifraga.com"] } : {}),
      bundleIdentifier: isProduction ? "com.juanifraga.rollo.app" : "com.juanifraga.rollo",
    },
    plugins: isProduction ? config.plugins : [WITHOUT_PUSH, ...(config.plugins ?? [])],
  };
};
