import { formatHandle, normalizeUsername, suggestUsername, usernameError } from "../username";

const INVALID = "El nombre de usuario puede tener letras, números, punto y guion bajo (3 a 30).";

describe("normalizeUsername", () => {
  it("strips the leading @, trims and lowercases", () => {
    expect(normalizeUsername("  @Juani.F ")).toBe("juani.f");
    expect(normalizeUsername("Cami_99")).toBe("cami_99");
  });
});

describe("usernameError", () => {
  it("accepts valid usernames, with or without @", () => {
    expect(usernameError("juani")).toBeNull();
    expect(usernameError("@Juani.f_1")).toBeNull();
    expect(usernameError("a".repeat(30))).toBeNull();
  });

  it("rejects too short, too long and invalid characters", () => {
    expect(usernameError("ab")).toBe(INVALID);
    expect(usernameError("a".repeat(31))).toBe(INVALID);
    expect(usernameError("juani!")).toBe(INVALID);
    expect(usernameError("juan ignacio")).toBe(INVALID);
    expect(usernameError("")).toBe(INVALID);
  });

  it("rejects leading/trailing dots and consecutive dots", () => {
    expect(usernameError(".juani")).toBe(INVALID);
    expect(usernameError("juani.")).toBe(INVALID);
    expect(usernameError("jua..ni")).toBe(INVALID);
  });
});

describe("suggestUsername", () => {
  it("uses the lowercased local part of the email", () => {
    expect(suggestUsername("Juani.Fraga@gmail.com")).toBe("juani.fraga");
  });

  it("removes invalid characters and cleans up dots", () => {
    expect(suggestUsername("juani+rollo@x.com")).toBe("juanirollo");
    expect(suggestUsername("..ju..ani..@x.com")).toBe("ju.ani");
    expect(suggestUsername("josé@x.com")).toBe("jos");
  });

  it("trims to 30 characters", () => {
    expect(suggestUsername(`${"a".repeat(40)}@x.com`)).toBe("a".repeat(30));
  });

  it("pads short results so it is always valid", () => {
    expect(usernameError(suggestUsername("a@x.com"))).toBeNull();
    expect(usernameError(suggestUsername("+++@x.com"))).toBeNull();
    expect(suggestUsername("ab@x.com").startsWith("ab")).toBe(true);
  });
});

describe("formatHandle", () => {
  it("prefixes @", () => {
    expect(formatHandle("cami")).toBe("@cami");
  });
});
