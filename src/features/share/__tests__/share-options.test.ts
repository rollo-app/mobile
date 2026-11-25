import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { joinLinkUrl } from "@/features/events/join-link";
import { inviteMessage } from "../invite";
import { shareKind } from "../share-options";

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

describe("inviteMessage", () => {
  it("links a regular roll with its code", () => {
    expect(inviteMessage(detail())).toBe(`Sumate a "Viaje al sur" en Rollo con el código HUB5FT: ${LINK}`);
  });
  it("links an event", () => {
    expect(inviteMessage(detail({ type: "event" }))).toBe(`Sumate a "Viaje al sur" en Rollo: ${LINK}`);
  });
});
