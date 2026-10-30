import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import { ApiError } from "@/api/client";
import * as friendActions from "@/features/friends/actions";
import * as momentSync from "@/features/moments/moment-sync";
import * as tripActions from "@/features/trips/actions";
import { setActiveTripId } from "@/storage/active-trip";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/friends/actions");
jest.mock("@/features/trips/actions");
jest.mock("@/features/moments/moment-sync", () => ({ syncMoments: jest.fn(async () => {}) }));
const trips = jest.mocked(tripActions);
const friends = jest.mocked(friendActions);
const sync = jest.mocked(momentSync);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";

type Member = tripActions.TripDetail["me"];
const member = (over: Partial<Member> & Pick<Member, "id" | "userId" | "name">): Member => ({
  username: over.name.toLowerCase(),
  avatarUrl: null,
  role: "member",
  isCreator: false,
  blockedByMe: false,
  ...over,
});
const admin = member({ id: "m1", userId: "u1", name: "Juani", role: "admin", isCreator: true });
const plain = member({ id: "m5", userId: "u5", name: "Fede" });

const detail = (me: Member, over: Partial<tripActions.Trip> = {}): tripActions.TripDetail => {
  const endsAt = Date.now() + 9 * DAY;
  return {
    trip: {
      id: SUR,
      name: "Viaje al sur",
      joinCode: "HUB5FT",
      timezone: "America/Argentina/Buenos_Aires",
      startsAt: Date.now() - 2 * DAY,
      endsAt,
      revealAt: endsAt,
      revealed: false,
      dailyPhotoLimit: 10,
      dailyVideoLimit: 3,
      featuringDisabled: false,
      photoLimitMode: "daily",
      totalPhotoLimit: null,
      momentMode: "off",
      momentWindowStart: 540,
      momentWindowEnd: 1380,
      createdBy: { userId: "u1", name: "Juani" },
      ...over,
    },
    me,
    members: [admin, plain].map((m) => (m.id === me.id ? me : m)),
    today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
    totalUploaded: 3,
  };
};

async function openBoard(d: tripActions.TripDetail) {
  trips.fetchTrip.mockResolvedValue(d);
  await setActiveTripId(SUR);
  await renderRouter(routes, { initialUrl: "/roll" });
  await screen.findByText(/^En el rollo · /);
}

async function openEditor(d = detail(admin)) {
  await openBoard(d);
  await fireEvent.press(await screen.findByText("Editar rollo"));
  await screen.findByRole("button", { name: "Guardar" });
}

const dateOf = (label: string) => Number(screen.getByLabelText(label).props.accessibilityValue.text);

beforeEach(async () => {
  for (const mock of [...Object.values(friends), ...Object.values(trips)]) (mock as Partial<jest.Mock>).mockReset?.();
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
  trips.fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur")] });
  trips.fetchFeed.mockResolvedValue({ revealed: false, revealAt: Date.now() + DAY, items: [] });
  friends.fetchFriends.mockResolvedValue([]);
  friends.fetchFriendRequests.mockResolvedValue([]);
});

describe("Editar rollo row", () => {
  it("shows for an admin of a rollo that has not ended", async () => {
    await openBoard(detail(admin));
    expect(screen.getByText("Editar rollo")).toBeVisible();
  });

  it("does not show for a plain member", async () => {
    await openBoard(detail(plain));
    expect(screen.queryByText("Editar rollo")).toBeNull();
  });

  it("does not show once the rollo ended", async () => {
    await openBoard(detail(admin, { startsAt: Date.now() - 5 * DAY, endsAt: Date.now() - DAY, revealAt: Date.now() + DAY }));
    expect(screen.queryByText("Editar rollo")).toBeNull();
  });
});

describe("Editar rollo screen", () => {
  it("loads the current values and locks the start of a rollo that already began", async () => {
    const d = detail(admin);
    await openEditor(d);
    expect(dateOf("Termina")).toBe(d.trip.endsAt);
    expect(screen.getByLabelText("10 fotos")).toBeVisible();
    expect(screen.getByRole("button", { name: "Al terminar" })).toBeSelected();
    expect(screen.getByLabelText("Empieza")).toBeDisabled();
    expect(screen.getByText("El rollo ya empezó: el inicio no se cambia.")).toBeVisible();
    expect(screen.getByText("El rollo ya empezó: el tipo de cupo no se cambia.")).toBeVisible();
  });

  it("tells that moment changes apply from tomorrow only on a rollo in progress", async () => {
    await openEditor(detail(admin));
    expect(screen.getByText(/Los cambios valen desde mañana\./)).toBeVisible();
  });

  it("does not say it before the rollo starts", async () => {
    await openEditor(detail(admin, { startsAt: Date.now() + DAY }));
    expect(screen.queryByText(/Los cambios valen desde mañana/)).toBeNull();
  });

  it("keeps Guardar disabled until something changes", async () => {
    await openEditor();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    await fireEvent(screen.getByLabelText("10 fotos"), "valueChange", 12);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });

  it("sends only the new end and the reveal that follows it, then closes", async () => {
    const d = detail(admin);
    trips.updateTrip.mockResolvedValue(d.trip);
    await openEditor(d);
    const newEnd = d.trip.endsAt + 2 * DAY;
    await fireEvent(screen.getByLabelText("Termina"), "dateChange", new Date(newEnd));
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(trips.updateTrip).toHaveBeenCalledWith(SUR, { endsAt: newEnd, revealAt: newEnd }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(sync.syncMoments).toHaveBeenCalled();
  });

  it("does not touch the moments when only the quota changes", async () => {
    const d = detail(admin);
    trips.updateTrip.mockResolvedValue(d.trip);
    await openEditor(d);
    sync.syncMoments.mockClear(); // the app syncs on its own when it opens
    await fireEvent(screen.getByLabelText("10 fotos"), "valueChange", 12);
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(trips.updateTrip).toHaveBeenCalledWith(SUR, { dailyPhotoLimit: 12 }));
    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(sync.syncMoments).not.toHaveBeenCalled();
  });

  it("shows the server error inline and keeps the edited values", async () => {
    const d = detail(admin);
    trips.updateTrip.mockRejectedValue(new ApiError(400, "El revelado no puede ser antes del fin"));
    await openEditor(d);
    const newEnd = d.trip.endsAt + 2 * DAY;
    await fireEvent(screen.getByLabelText("Termina"), "dateChange", new Date(newEnd));
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("El revelado no puede ser antes del fin")).toBeVisible();
    expect(dateOf("Termina")).toBe(newEnd);
    expect(screen).toHavePathname("/edit-trip");
  });
});
