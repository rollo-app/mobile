import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the whole config; this only switches what differs between the two builds.
// - development (default): `npx expo run:ios --device` signed with the free Personal Team, which
//   already owns `com.juanifraga.rollo`.
// - production (`APP_VARIANT=production`, set by eas.json): EAS builds for TestFlight/App Store,
//   signed with the paid team that registered `com.juanifraga.rollo.app`.
// Being a function keeps app.json writable by tools like `eas init`.
const IS_PRODUCTION = process.env.APP_VARIANT === "production";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PRODUCTION ? "Rollo" : "Rollo Dev",
  slug: config.slug ?? "rollo",
  ios: {
    ...config.ios,
    bundleIdentifier: IS_PRODUCTION ? "com.juanifraga.rollo.app" : "com.juanifraga.rollo",
  },
});
