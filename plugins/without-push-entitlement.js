// The free Apple account (Personal Team) can't sign apps with the Push Notifications capability,
// and expo-notifications always adds it. Rollo only uses local notifications (the reveal reminder),
// which don't need it, so this removes the `aps-environment` entitlement.
// It must be the FIRST plugin in app.json: mods run in reverse order, so it runs after expo-notifications.
// Remove this plugin once the app is built with a paid developer account and uses push.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["aps-environment"];
    if (cfg.ios?.entitlements) delete cfg.ios.entitlements["aps-environment"];
    return cfg;
  });
};
