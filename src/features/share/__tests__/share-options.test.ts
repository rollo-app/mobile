import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { joinLinkUrl } from "@/features/events/join-link";
import { inviteMessage } from "../invite";
import { shareKind, shareOptions } from "../share-options";
import { whatsAppUrl } from "../share-story";

const LINK = joinLinkUrl("HUB5FT");

const detail = (o: { revealed?: boolean; full?: boolean; featuringDisabled?: boolean; type?: "trip" | "event" } = {}) =>
  ({
    trip: {
      name: "Viaje al sur",
      joinCode: "HUB5FT",
      type: o.type ?? "trip",
      coverUrl: null,
      revealed: o.revealed ?? false,
      featuringDisabled: o.featuringDisabled ?? false,
      maxMembers: o.full ? 1 : 10,
    },
    members: [{ id: "m1" }],
    memberCount: 1,
  }) as unknown as TripDetail;

const photo = (shareable: boolean) => ({ id: "p", shareable, type: "photo" }) as unknown as RevealedPhoto;

describe("shareKind", () => {
  it("is invite on an unrevealed roll with room", () => expect(shareKind(detail(), [])).toBe("invite"));
  it("is null on an unrevealed full roll", () => expect(shareKind(detail({ full: true }), [])).toBeNull());
  it("is collage when revealed with shareable photos", () => expect(shareKind(detail({ revealed: true }), [photo(true)])).toBe("collage"));
  it("is null on a private revealed roll", () => expect(shareKind(detail({ revealed: true, featuringDisabled: true }), [photo(true)])).toBeNull());
  it("is null when no photo can be shared", () => expect(shareKind(detail({ revealed: true }), [photo(false)])).toBeNull());
});

describe("shareOptions", () => {
  it("lists the invite options", () => expect(shareOptions("invite", true)).toEqual(["link", "whatsapp", "instagram"]));
  it("lists the collage options", () => expect(shareOptions("collage", true)).toEqual(["whatsapp", "instagram"]));
  it("drops WhatsApp when it is not installed", () => {
    expect(shareOptions("invite", false)).toEqual(["link", "instagram"]);
    expect(shareOptions("collage", false)).toEqual(["instagram"]);
  });
});

describe("inviteMessage", () => {
  it("links a regular roll with its code", () => {
    expect(inviteMessage(detail())).toBe(`Sumate a "Viaje al sur" en Rollo con el código HUB5FT: ${LINK}`);
  });
  it("links an event", () => {
    expect(inviteMessage(detail({ type: "event" }))).toBe(`Sumate a "Viaje al sur" en Rollo: ${LINK}`);
  });
});

describe("whatsAppUrl", () => {
  it("encodes &, quotes and emoji", () => {
    const url = whatsAppUrl('a & "b" 🎞');
    expect(url).toBe("whatsapp://send?text=a%20%26%20%22b%22%20%F0%9F%8E%9E");
  });
});
