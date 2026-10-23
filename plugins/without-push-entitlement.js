// The free Apple account (Personal Team) can't sign apps with the Push Notifications capability,
// and expo-notifications always adds it. This removes the `aps-environment` entitlement so the dev
// build can be signed (there, getting a push token fails silently).
// Applied only in the development variant, as the FIRST plugin, from app.config.ts: mods run in
// reverse order, so it runs after expo-notifications. The production build keeps push.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["aps-environment"];
    if (cfg.ios?.entitlements) delete cfg.ios.entitlements["aps-environment"];
    return cfg;
  });
};
