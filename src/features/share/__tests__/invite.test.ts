import type { TripDetail } from "@/features/trips/actions";
import { canShareInvite, inviteCaption, inviteLink, inviteMessage, inviteSwatches, whatsAppInviteMessage } from "../invite";

jest.mock("@/features/trips/thumbhash-color", () => ({
  thumbHashAverageColor: jest.fn((hash: string) => (hash === "bad" ? null : { r: hash.length, g: 2, b: 3 })),
}));

const TZ = "America/Argentina/Buenos_Aires";
const DEC_12 = Date.UTC(2026, 11, 12, 15);
const JAN_3 = Date.UTC(2027, 0, 3, 15);
const JAN_9 = Date.UTC(2027, 0, 9, 15);

type Overrides = {
  type?: "trip" | "event";
  coverUrl?: string | null;
  revealed?: boolean;
  maxMembers?: number;
  members?: number;
  memberCount?: number;
  startsAt?: number;
  endsAt?: number;
};

const detail = (o: Overrides = {}) =>
  ({
    trip: {
      type: o.type ?? "trip",
      coverUrl: o.coverUrl ?? null,
      revealed: o.revealed ?? false,
      maxMembers: o.maxMembers ?? 10,
      joinCode: "ABC123",
      startsAt: o.startsAt ?? JAN_3,
      endsAt: o.endsAt ?? JAN_9,
      timezone: TZ,
    },
    members: Array.from({ length: o.members ?? 2 }, (_, i) => ({ id: `u${i}` })),
    ...(o.memberCount === undefined ? {} : { memberCount: o.memberCount }),
  }) as unknown as TripDetail;

describe("canShareInvite", () => {
  it("is true for a regular rollo that is not revealed and has room", () => {
    expect(canShareInvite(detail())).toBe(true);
  });

  it("is true for an event with room", () => {
    expect(canShareInvite(detail({ type: "event", coverUrl: "https://x/c.jpg" }))).toBe(true);
  });

  it("is false for a full roll", () => {
    expect(canShareInvite(detail({ members: 10, maxMembers: 10 }))).toBe(false);
  });

  it("is false for an event whose server total is full even if members lists fewer", () => {
    expect(canShareInvite(detail({ type: "event", members: 2, memberCount: 10, maxMembers: 10 }))).toBe(false);
  });

  it("is false for a revealed roll", () => {
    expect(canShareInvite(detail({ revealed: true }))).toBe(false);
  });
});

describe("inviteCaption", () => {
  const event = (memberCount: number) =>
    detail({ type: "event", coverUrl: "https://x/c.jpg", startsAt: DEC_12, endsAt: DEC_12, memberCount });

  it("shows the day and the count for an event with a cover", () => {
    expect(inviteCaption(event(84))).toBe("12 de diciembre · 84 personas ya se unieron");
  });

  it("invites to be among the first below 5 people", () => {
    expect(inviteCaption(event(3))).toBe("12 de diciembre · Sé de los primeros en unirte");
  });

  it("switches from 'first to join' to the count at 5 people", () => {
    expect(inviteCaption(event(4))).toBe("12 de diciembre · Sé de los primeros en unirte");
    expect(inviteCaption(event(5))).toBe("12 de diciembre · 5 personas ya se unieron");
  });

  it("uses the date range and 'sin revelar' for an event without a cover", () => {
    expect(inviteCaption(detail({ type: "event" }))).toBe("3 – 9 de enero · sin revelar");
  });

  it("shows the date range and 'sin revelar' for a rollo without a cover", () => {
    expect(inviteCaption(detail())).toBe("3 – 9 de enero · sin revelar");
  });
});

describe("inviteSwatches", () => {
  it("skips missing and undecodable thumbhashes", () => {
    expect(inviteSwatches([null, "ab", "bad", "abc"])).toEqual([
      { r: 2, g: 2, b: 3 },
      { r: 3, g: 2, b: 3 },
    ]);
  });

  it("caps at 16 by default and honors a custom max", () => {
    const many = Array.from({ length: 30 }, () => "abc");
    expect(inviteSwatches(many)).toHaveLength(16);
    expect(inviteSwatches(many, 4)).toHaveLength(4);
  });

  it("is empty for an empty list or only nulls", () => {
    expect(inviteSwatches([])).toEqual([]);
    expect(inviteSwatches([null, null])).toEqual([]);
  });
});

describe("inviteLink", () => {
  it("is the public join link of the rollo's code", () => {
    expect(inviteLink(detail())).toBe("https://rolloproject.com/join/ABC123");
  });
});

describe("invite messages", () => {
  const named = { ...detail(), trip: { ...detail().trip, name: "Viaje al sur" } } as TripDetail;

  it("the general message quotes the name (it may land anywhere: iMessage, mail…)", () => {
    expect(inviteMessage(named)).toBe('Sumate a "Viaje al sur" en Rollo: https://rolloproject.com/join/ABC123');
  });

  it("the WhatsApp message puts the name in bold with WhatsApp's asterisks", () => {
    expect(whatsAppInviteMessage(named)).toBe("Sumate a *Viaje al sur* en Rollo: https://rolloproject.com/join/ABC123");
  });
});
