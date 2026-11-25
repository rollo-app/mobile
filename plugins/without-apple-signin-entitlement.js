// The free Apple account (Personal Team) can't sign apps with the Sign in with Apple capability, and
// expo-apple-authentication's plugin (applied automatically by prebuild) always adds it. This removes the
// `com.apple.developer.applesignin` entitlement so the dev build can be signed (there the Apple button is
// hidden anyway: `appleSignInEnabled`). Applied only in the development variant, before the other plugins
// in app.config.ts, so its mod runs after the one that adds the entitlement. The production build keeps it.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutAppleSignInEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["com.apple.developer.applesignin"];
    if (cfg.ios?.entitlements) delete cfg.ios.entitlements["com.apple.developer.applesignin"];
    return cfg;
  });
};
