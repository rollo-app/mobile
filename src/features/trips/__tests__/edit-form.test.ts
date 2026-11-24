import type { TripDetail } from "../actions";
import { canSave, changedFields, editableFields, lockedNote, revealFollowsEnd, settingsOf, type TripSettings } from "../edit-form";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2027, 0, 10, 12);
const END = START + 3 * DAY;

const base: TripSettings = {
  startsAt: START,
  endsAt: END,
  revealAt: END,
  photoLimitMode: "daily",
  dailyPhotoLimit: 10,
  totalPhotoLimit: null,
  momentMode: "photo",
  momentWindowStart: 540,
  momentWindowEnd: 1380,
  description: "",
  contestEnabled: false,
  contestVotingDays: 3,
};

const trip = (over: Partial<TripDetail["trip"]> = {}) =>
  ({ ...base, id: "t1", name: "Sur", revealed: false, ...over }) as TripDetail["trip"];

describe("settingsOf", () => {
  it("picks only the editable settings from the trip", () => {
    expect(settingsOf(trip({ photoLimitMode: "total", totalPhotoLimit: 20 }))).toEqual({
      ...base,
      photoLimitMode: "total",
      totalPhotoLimit: 20,
    });
  });
});

describe("editableFields", () => {
  const all = (v: boolean) => ({ start: v, end: v, reveal: v, limitMode: v, limit: v, moment: v, description: true, contest: v });

  it("allows everything before the rollo starts", () => {
    expect(editableFields(trip(), START - 1)).toEqual(all(true));
  });

  it("locks the start and the quota type once it is running", () => {
    expect(editableFields(trip(), START + 1)).toEqual({ ...all(true), start: false, limitMode: false });
  });

  it("keeps the description editable always and the contest until the reveal", () => {
    expect(editableFields(trip(), END)).toEqual({ ...all(false), contest: true });
    expect(editableFields(trip({ revealed: true }), END + DAY)).toEqual(all(false));
  });
});

describe("settingsOf contest and description", () => {
  it("reads the description and turns the voting hours into days", () => {
    const s = settingsOf(trip({ description: "Hola", contest: { enabled: true, votingHours: 120 } } as never));
    expect(s).toMatchObject({ description: "Hola", contestEnabled: true, contestVotingDays: 5 });
  });

  it("defaults to an empty description and the contest off (3 days)", () => {
    expect(settingsOf(trip({ description: null, contest: null } as never))).toMatchObject({
      description: "",
      contestEnabled: false,
      contestVotingDays: 3,
    });
  });
});

describe("lockedNote", () => {
  it("explains why each field is locked", () => {
    expect(lockedNote("start")).toBe("El rollo ya empezó: el inicio no se cambia.");
    expect(lockedNote("limitMode")).toBe("El rollo ya empezó: el tipo de cupo no se cambia.");
  });
});

describe("revealFollowsEnd", () => {
  it("is true only when the reveal equals the end", () => {
    expect(revealFollowsEnd(base)).toBe(true);
    expect(revealFollowsEnd({ ...base, revealAt: END + DAY })).toBe(false);
  });
});

describe("changedFields", () => {
  it("is empty when nothing changed", () => {
    expect(changedFields(base, { ...base }, "end")).toEqual({});
  });

  it("moves the reveal with the end when it follows it", () => {
    const after = { ...base, endsAt: END + DAY };
    expect(changedFields(base, after, "end")).toEqual({ endsAt: END + DAY, revealAt: END + DAY });
  });

  it("leaves the reveal alone when it is custom", () => {
    expect(changedFields(base, { ...base, endsAt: END + DAY }, "custom")).toEqual({ endsAt: END + DAY });
  });

  it("sends a custom reveal change", () => {
    expect(changedFields(base, { ...base, revealAt: END + DAY }, "custom")).toEqual({ revealAt: END + DAY });
  });

  it("never sends startsAt when it did not change", () => {
    expect("startsAt" in changedFields(base, { ...base, dailyPhotoLimit: 12 }, "end")).toBe(false);
    expect(changedFields(base, { ...base, startsAt: START + DAY }, "end")).toEqual({ startsAt: START + DAY });
  });

  it("sends the mode and the total when switching daily to total", () => {
    const after = { ...base, photoLimitMode: "total" as const, totalPhotoLimit: 25 };
    expect(changedFields(base, after, "end")).toEqual({ photoLimitMode: "total", totalPhotoLimit: 25 });
  });

  it("sends only the changed quota number in each mode", () => {
    expect(changedFields(base, { ...base, dailyPhotoLimit: 15 }, "end")).toEqual({ dailyPhotoLimit: 15 });
    const total = { ...base, photoLimitMode: "total" as const, totalPhotoLimit: 20 };
    expect(changedFields(total, { ...total, totalPhotoLimit: 30 }, "end")).toEqual({ totalPhotoLimit: 30 });
  });

  it("ignores the daily number while in total mode", () => {
    const total = { ...base, photoLimitMode: "total" as const, totalPhotoLimit: 20 };
    expect(changedFields(total, { ...total, dailyPhotoLimit: 99 }, "end")).toEqual({});
  });

  it("sends the moment settings that changed", () => {
    expect(changedFields(base, { ...base, momentMode: "photo_selfie", momentWindowEnd: 1200 }, "end")).toEqual({
      momentMode: "photo_selfie",
      momentWindowEnd: 1200,
    });
  });

  it("never includes featuringDisabled", () => {
    expect("featuringDisabled" in changedFields(base, { ...base, dailyPhotoLimit: 12 }, "end")).toBe(false);
  });
});

describe("changedFields description and contest", () => {
  it("sends the trimmed description, and an empty one to clear it", () => {
    expect(changedFields(base, { ...base, description: "  Hola  " }, "end")).toEqual({ description: "Hola" });
    expect(changedFields({ ...base, description: "Hola" }, { ...base, description: "  " }, "end")).toEqual({ description: "" });
  });

  it("sends the contest switch and the voting days as hours", () => {
    expect(changedFields(base, { ...base, contestEnabled: true, contestVotingDays: 5 }, "end")).toEqual({
      contestEnabled: true,
      contestVotingHours: 120,
    });
    expect(changedFields({ ...base, contestEnabled: true }, { ...base, contestEnabled: true, contestVotingDays: 7 }, "end")).toEqual({
      contestVotingHours: 168,
    });
  });
});

describe("canSave", () => {
  it("needs at least one change", () => {
    expect(canSave({})).toBe(false);
    expect(canSave({ dailyPhotoLimit: 12 })).toBe(true);
  });
});
