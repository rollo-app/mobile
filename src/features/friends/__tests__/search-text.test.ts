import { matchesSearch, normalizeSearch, searchQuery, searchText, SEARCH_MAX, SEARCH_MIN } from "../search-text";

describe("searchText", () => {
  it("lowercases, strips accents and collapses whitespace", () => {
    expect(searchText("  Cámi   PÉREZ ")).toBe("cami perez");
    expect(searchText("Ñandú")).toBe("nandu");
  });
});

describe("normalizeSearch", () => {
  it("drops every leading @", () => {
    expect(normalizeSearch("@Cámi")).toBe("cami");
    expect(normalizeSearch("@@cami")).toBe("cami");
  });
  it("trims before dropping the @", () => {
    expect(normalizeSearch("  @cami.p ")).toBe("cami.p");
    expect(normalizeSearch("ana   cam")).toBe("ana cam");
  });
  it("exposes the minimum length", () => {
    expect(SEARCH_MIN).toBe(2);
  });
});

describe("searchQuery", () => {
  it("caps the normalized query at the server maximum, without a trailing space", () => {
    expect(SEARCH_MAX).toBe(30);
    expect(searchQuery("a".repeat(40))).toBe("a".repeat(30));
    expect(searchQuery(`${"a".repeat(29)} bbb`)).toBe("a".repeat(29));
    expect(searchQuery("@Cámi")).toBe("cami");
  });
});

describe("matchesSearch", () => {
  it("matches a word start in the name", () => {
    expect(matchesSearch({ name: "Ana Camila", username: "anac" }, "cami")).toBe(true);
  });
  it("does not match inside a word", () => {
    expect(matchesSearch({ name: "Micaela", username: "mica" }, "cami")).toBe(false);
  });
  it("matches the username prefix", () => {
    expect(matchesSearch({ name: "Cami P", username: "cami.p" }, "cami.p")).toBe(true);
  });
  it("matches only by name when there is no username", () => {
    expect(matchesSearch({ name: "Cami", username: null }, "cam")).toBe(true);
    expect(matchesSearch({ name: "Lu", username: null }, "cam")).toBe(false);
  });
  it("matches across words with a space", () => {
    expect(matchesSearch({ name: "Ana Camila", username: null }, "ana cam")).toBe(true);
  });
  it("matches nothing for an empty query", () => {
    expect(matchesSearch({ name: "Ana", username: "ana" }, "")).toBe(false);
  });
});
