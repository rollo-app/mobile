import appJson from "../app.json";
import appConfig from "../app.config";

const PLUGIN = "./plugins/without-push-entitlement";
const configFor = (variant: string | undefined) => {
  const before = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try {
    return appConfig({ config: appJson.expo } as never);
  } finally {
    if (before === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = before;
  }
};

describe("app config", () => {
  it("app.json itself doesn't strip the push entitlement", () => {
    expect(appJson.expo.plugins).not.toContain(PLUGIN);
  });

  it("the production build keeps push (aps-environment from expo-notifications)", () => {
    const config = configFor("production");
    expect(config.plugins).not.toContain(PLUGIN);
    expect(config.plugins).toContain("expo-notifications");
    expect(config.ios?.bundleIdentifier).toBe("com.juanifraga.rollo.app");
  });

  it("the development build strips it, as the first plugin so it runs after expo-notifications", () => {
    const config = configFor(undefined);
    expect(config.plugins?.[0]).toBe(PLUGIN);
    expect(config.plugins).toContain("expo-notifications");
    expect(config.ios?.bundleIdentifier).toBe("com.juanifraga.rollo");
  });

  it("only the production build declares the Universal Links domain", () => {
    expect(configFor("production").ios?.associatedDomains).toEqual(["applinks:rollo.juanifraga.com"]);
    expect(configFor(undefined).ios?.associatedDomains).toBeUndefined();
  });

  it("is version 1.1.0 (runtimeVersion follows it)", () => {
    expect(appJson.expo.version).toBe("1.1.0");
  });

  it("keeps the EAS project id push tokens need", () => {
    expect(configFor("production").extra?.eas?.projectId).toBe("124fc671-d309-4a16-9606-e4e900286752");
  });
});
