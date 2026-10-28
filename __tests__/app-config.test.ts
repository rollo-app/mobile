import fs from "node:fs";
import path from "node:path";
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

  it("keeps the EAS project id push tokens need", () => {
    expect(configFor("production").extra?.eas?.projectId).toBe("124fc671-d309-4a16-9606-e4e900286752");
  });
});

describe("Liquid Glass icon", () => {
  const iconPath = (appJson.expo.ios as { icon: string }).icon;
  const dir = path.join(__dirname, "..", iconPath);

  it("ios.icon points to an Icon Composer bundle", () => {
    expect(iconPath).toMatch(/\.icon$/);
    expect(fs.existsSync(path.join(dir, "icon.json"))).toBe(true);
  });

  it("every asset icon.json references exists in Assets/", () => {
    const json = JSON.parse(fs.readFileSync(path.join(dir, "icon.json"), "utf8"));
    const layers = json.groups.flatMap((g: { layers: unknown[] }) => g.layers) as {
      "image-name": string;
      "image-name-specializations"?: { value: string }[];
    }[];
    const names = layers.flatMap((l) => [l["image-name"], ...(l["image-name-specializations"] ?? []).map((s) => s.value)]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(fs.existsSync(path.join(dir, "Assets", name))).toBe(true);
  });
});
