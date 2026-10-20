import { memberColor } from "@/features/map/member-color";
import { avatarColor, avatarUri, initialOf } from "../avatar-style";

describe("initialOf", () => {
  it("is the first letter, uppercase", () => {
    expect(initialOf("juani")).toBe("J");
    expect(initialOf("  ñandú ")).toBe("Ñ");
  });

  it("falls back to ? without a name", () => {
    expect(initialOf("")).toBe("?");
    expect(initialOf("   ")).toBe("?");
    expect(initialOf(null)).toBe("?");
  });
});

describe("avatarColor", () => {
  it("is the member color for that id", () => {
    expect(avatarColor("u1")).toBe(memberColor("u1"));
  });
});

describe("avatarUri", () => {
  it("prefixes the base url to the public path", () => {
    expect(avatarUri("/avatars/u1/a.jpg", "https://api.test")).toBe("https://api.test/avatars/u1/a.jpg");
  });

  it("is null without an avatar", () => {
    expect(avatarUri(null, "https://api.test")).toBeNull();
    expect(avatarUri(undefined, "https://api.test")).toBeNull();
  });
});
