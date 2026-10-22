import { rollSummary } from "../summary";

const TZ = "America/Argentina/Buenos_Aires";
const at = (iso: string) => Date.parse(iso);
const media = (photos: number, videos: number) => [
  ...Array.from({ length: photos }, () => ({ type: "photo" as const })),
  ...Array.from({ length: videos }, () => ({ type: "video" as const })),
];

describe("rollSummary", () => {
  it("counts photos, videos, people and days (inclusive, in the trip's zone)", () => {
    expect(
      rollSummary({
        media: media(64, 3),
        people: 8,
        startsAt: at("2027-01-10T09:00:00-03:00"),
        endsAt: at("2027-01-15T22:00:00-03:00"),
        timeZone: TZ,
      }),
    ).toBe("64 fotos · 3 videos · 8 personas · 6 días");
  });

  it("leaves out videos when there are none", () => {
    expect(
      rollSummary({ media: media(2, 0), people: 2, startsAt: at("2027-01-10T09:00:00-03:00"), endsAt: at("2027-01-11T09:00:00-03:00"), timeZone: TZ }),
    ).toBe("2 fotos · 2 personas · 2 días");
  });

  it("uses the singular forms", () => {
    expect(
      rollSummary({ media: media(1, 1), people: 1, startsAt: at("2027-01-10T09:00:00-03:00"), endsAt: at("2027-01-10T23:00:00-03:00"), timeZone: TZ }),
    ).toBe("1 foto · 1 video · 1 persona · 1 día");
  });

  it("counts days by the trip's local calendar, not by UTC", () => {
    // 22:00 in Buenos Aires is already the next day in UTC.
    expect(
      rollSummary({ media: media(0, 0), people: 3, startsAt: at("2027-01-10T22:00:00-03:00"), endsAt: at("2027-01-11T01:00:00-03:00"), timeZone: TZ }),
    ).toBe("0 fotos · 3 personas · 2 días");
  });
});
