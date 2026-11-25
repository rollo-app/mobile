import { fireEvent, renderRouter, screen, within } from "expo-router/testing-library";
import "@/test/reanimated";
import * as actions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";
import { keepOriginals } from "@/test/trip";

jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";
const LABEL = "Compartir en Instagram";

const member = (id: string) => ({ id, userId: `u-${id}`, name: id, username: null, avatarUrl: null, role: "member" as const, isCreator: false, blockedByMe: false });

const detail = (over: Partial<actions.Trip> = {}, extraMembers = 0): actions.TripDetail => {
  const me = { ...member("m1"), role: "admin" as const, groupIds: [] };
  const members = [me, ...Array.from({ length: extraMembers }, (_, i) => member(`x${i}`))];
  return {
    trip: {
      id: SUR,
      name: "Viaje al sur",
      joinCode: "HUB5FT",
      timezone: "America/Argentina/Buenos_Aires",
      startsAt: Date.now() - 5 * DAY,
      endsAt: Date.now() - 2 * DAY,
      revealAt: Date.now() - DAY,
      revealed: true,
      dailyPhotoLimit: 10,
      dailyVideoLimit: 3,
      featuringDisabled: false,
      maxMembers: 15,
      photoLimitMode: "daily",
      totalPhotoLimit: null,
      momentMode: "off",
      momentWindowStart: 540,
      momentWindowEnd: 1380,
      originals: keepOriginals,
      description: null,
      contest: null,
      type: "trip",
      coverUrl: null,
      groups: [],
      createdBy: null,
      ...over,
    },
    me,
    members,
    memberCount: members.length,
    today: { date: "2027-01-12", photosLeft: 7, videosLeft: 2 },
    totalUploaded: 3,
  };
};

const photo = (id: string, shareable: boolean): actions.Feed["items"][number] => ({
  groupIds: [],
  id,
  type: "photo",
  takenAt: Date.now() - DAY,
  day: "2027-01-12",
  lat: null,
  lng: null,
  caption: null,
  thumbhash: null,
  durationS: null,
  author: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null },
  width: 4000,
  height: 3000,
  shareable,
  files: { thumb: `/m/${id}/thumb`, original: `/m/${id}/original` },
});

const open = async (d: actions.TripDetail, url: string, items: actions.Feed["items"] = []) => {
  mocked.fetchTrip.mockResolvedValue(d);
  mocked.fetchFeedPage.mockResolvedValue({ revealed: d.trip.revealed, revealAt: d.trip.revealAt, items, nextCursor: null });
  await markPresentationSeen(SUR);
  await renderRouter(routes, { initialUrl: url });
};

beforeEach(async () => {
  jest.clearAllMocks();
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")], active: SUR });
});

describe("Compartir entries", () => {
  const button = () => screen.queryByRole("button", { name: "Compartir" });

  describe("revealed rollo", () => {
    it("shows the toolbar button when there are shareable photos and opens the collage screen", async () => {
      await open(detail(), "/roll?view=roll", [photo("a", true), photo("b", false)]);
      await fireEvent.press(await screen.findByRole("button", { name: "Compartir" }));
      expect(screen).toHavePathname("/share-story");
      expect(screen).toHaveSearchParams({ tripId: SUR, kind: "collage" });
    });

    it("has no Compartir en Instagram row", async () => {
      await open(detail(), "/roll?view=roll", [photo("a", true)]);
      await screen.findByRole("button", { name: "Compartir" });
      expect(screen.queryByText(LABEL)).toBeNull();
    });

    it("hides the button on a private rollo", async () => {
      await open(detail({ featuringDisabled: true }), "/roll?view=roll", [photo("a", true)]);
      await screen.findByText("Personas");
      expect(button()).toBeNull();
    });

    it("hides the button when no photo can be shared", async () => {
      await open(detail(), "/roll?view=roll", [photo("a", false)]);
      await screen.findByText("Personas");
      expect(button()).toBeNull();
    });
  });

  describe("Invitar", () => {
    const pending = { revealed: false, revealAt: Date.now() + DAY };

    it("shows the button on an unrevealed rollo with room and opens the invitation screen", async () => {
      await open(detail(pending), "/roll");
      await fireEvent.press(await screen.findByRole("button", { name: "Compartir" }));
      expect(screen).toHavePathname("/share-story");
      expect(screen).toHaveSearchParams({ tripId: SUR, kind: "invite" });
    });

    it("has no Compartir en Instagram row", async () => {
      await open(detail(pending), "/roll");
      await screen.findByText("Invitar");
      expect(screen.queryByText(LABEL)).toBeNull();
    });

    it("hides the button when the rollo is full", async () => {
      await open(detail({ ...pending, maxMembers: 2 }, 1), "/roll");
      await screen.findByText("Invitar");
      expect(button()).toBeNull();
    });

    it("shows no invitation row on a revealed rollo", async () => {
      await open(detail(), "/roll?view=roll");
      await screen.findByText("Personas");
      expect(screen.queryByText("Invitar")).toBeNull();
    });
  });

  describe("organizer QR", () => {
    it("offers the button and opens the invitation", async () => {
      await open(detail({ revealed: false, revealAt: Date.now() + DAY }), `/event-qr?tripId=${SUR}`);
      const button = await screen.findByRole("button", { name: LABEL });
      expect(within(button).getByTestId("instagram-logo")).toBeVisible();
      await fireEvent.press(button);
      expect(screen).toHavePathname("/share-story");
      expect(screen).toHaveSearchParams({ tripId: SUR, kind: "invite" });
    });

    it("hides the button when the event is full", async () => {
      await open(detail({ revealed: false, revealAt: Date.now() + DAY, maxMembers: 2 }, 1), `/event-qr?tripId=${SUR}`);
      await screen.findByRole("button", { name: "Compartir" });
      expect(screen.queryByRole("button", { name: LABEL })).toBeNull();
    });
  });
});
