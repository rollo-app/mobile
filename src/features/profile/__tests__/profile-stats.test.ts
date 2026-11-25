import { emptyStatsText, mutualText, spokenStats, statParts } from "../profile-stats";

const kinds = (p: ReturnType<typeof statParts>) => p.map((x) => x.kind);
const words = (p: ReturnType<typeof statParts>) => p.map((x) => x.word);

describe("statParts", () => {
  it("lists rolls, photos and friends in that order", () => {
    const parts = statParts({ rolls: 8, photos: 34, friends: 12 });
    expect(kinds(parts)).toEqual(["rolls", "photos", "friends"]);
    expect(words(parts)).toEqual(["rollos", "fotos", "amigos"]);
  });

  it("uses singulars", () => {
    expect(words(statParts({ rolls: 1, photos: 1, friends: 1 }))).toEqual(["rollo", "foto", "amigo"]);
  });

  it("formats thousands with a dot", () => {
    expect(statParts({ friends: 1284 })[0]?.count).toBe("1.284");
  });

  it("omits zeros", () => {
    expect(kinds(statParts({ rolls: 0, photos: 3, friends: 0, own: true }))).toEqual(["photos"]);
  });

  it("treats missing counts as null", () => {
    expect(kinds(statParts({ friends: 2 }))).toEqual(["friends"]);
    expect(kinds(statParts({ rolls: undefined, photos: null, friends: 2 }))).toEqual(["friends"]);
  });

  it("drops rolls and photos without canSee", () => {
    expect(kinds(statParts({ rolls: 5, photos: 9, friends: 48, canSee: false, mutual: 3 }))).toEqual(["friends"]);
  });

  it("hides friends of a hidden list with none in common", () => {
    expect(statParts({ friends: 48, canSee: false, mutual: 0 })).toEqual([]);
  });
});

describe("emptyStatsText", () => {
  it("says Todavía no tenés amigos on your own empty profile", () => {
    expect(emptyStatsText({ rolls: 0, photos: 0, friends: 0, own: true })).toBe("Todavía no tenés amigos");
    expect(emptyStatsText({ rolls: 0, photos: 0, friends: 0, own: false })).toBeNull();
    expect(emptyStatsText({ rolls: 2, photos: 0, friends: 0, own: true })).toBeNull();
  });
});

describe("mutualText", () => {
  it("writes mutual friends on their own line", () => {
    expect(mutualText(3)).toBe("3 amigos en común");
    expect(mutualText(1)).toBe("1 amigo en común");
    expect(mutualText(0)).toBeNull();
    expect(mutualText(undefined)).toBeNull();
  });
});

describe("spokenStats", () => {
  it("speaks the line as one phrase", () => {
    expect(spokenStats(statParts({ rolls: 8, photos: 34, friends: 12 }))).toBe("8 rollos, 34 fotos, 12 amigos");
  });
});
