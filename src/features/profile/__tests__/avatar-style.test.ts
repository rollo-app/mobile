import { memberColor } from "@/features/map/member-color";
import { avatarColor, avatarUri, initialOf } from "../avatar-style";

describe("initialOf", () => {
  it("is the first letter, uppercase", () => {
    expect(initialOf("juani")).toBe("J");
    expect(initialOf("  ñandú ")).toBe("Ñ");
  });

  it("skips leading emoji, punctuation and spaces", () => {
    expect(initialOf("👩🏽‍💻 Priya")).toBe("P");
    expect(initialOf("(la rubia)")).toBe("L");
    expect(initialOf("  ana")).toBe("A");
  });

  it("never turns the letter into several characters", () => {
    expect(initialOf("ßeta")).toBe("ß");
  });

  it("handles non-Latin and composed letters", () => {
    expect(initialOf("Đặng")).toBe("Đ");
    expect(initialOf("李明")).toBe("李");
    expect(initialOf("e\u0301lan")).toBe("E\u0301");
  });

  it("is null when there is no letter or digit", () => {
    expect(initialOf("")).toBeNull();
    expect(initialOf("   ")).toBeNull();
    expect(initialOf(null)).toBeNull();
    expect(initialOf("🎉🎉")).toBeNull();
    expect(initialOf("...")).toBeNull();
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
