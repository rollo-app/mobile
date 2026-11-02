import { Alert } from "react-native";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import "@/test/reanimated";
import * as featuredActions from "@/features/featured/actions";
import * as friendActions from "@/features/friends/actions";
import * as actions from "@/features/trips/actions";
import { markPresentationSeen } from "@/storage/presentation";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");
jest.mock("@/features/featured/actions");
const mocked = jest.mocked(actions);
const featured = jest.mocked(featuredActions);

const SUR = "11111111-1111-4111-8111-111111111111";
const DAY = 24 * 60 * 60 * 1000;

const member = (id: string, name: string, role: "admin" | "member") => ({
  id,
  userId: `u-${id}`,
  name,
  username: null,
  avatarUrl: null,
  role,
  isCreator: false,
  blockedByMe: false,
});

const detail = (opts: { role?: "admin" | "member"; featuringDisabled?: boolean; allowFeaturing?: boolean; revealed?: boolean; isCreator?: boolean } = {}): actions.TripDetail => {
  const { role = "admin", featuringDisabled = false, allowFeaturing = true, revealed = false, isCreator = role === "admin" } = opts;
  const me = { ...member("m1", "Juani", role), isCreator, allowFeaturing };
  return {
    trip: {
      id: SUR,
      name: "Viaje al sur",
      joinCode: "HUB5FT",
      timezone: "America/Argentina/Buenos_Aires",
      startsAt: Date.now() - 2 * DAY,
      endsAt: Date.now() + (revealed ? -DAY : 9 * DAY),
      revealAt: Date.now() + (revealed ? -DAY : 9 * DAY),
      revealed,
      dailyPhotoLimit: 10,
      dailyVideoLimit: 3,
      featuringDisabled,
      photoLimitMode: "daily",
      totalPhotoLimit: null,
      momentMode: "off",
      momentWindowStart: 540,
      momentWindowEnd: 1380,
      createdBy: null,
    },
    me,
    members: [me, member("m2", "Fede", role === "admin" ? "member" : "admin")],
    today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
    totalUploaded: 12,
  };
};

const MINE = "Tus fotos en otros perfiles";
const PRIVATE = "Rollo privado";

let alert: jest.SpyInstance;

beforeEach(async () => {
  jest.mocked(friendActions).fetchFriends.mockResolvedValue([]);
  mocked.fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur")] });
  mocked.fetchFeed.mockReturnValue(new Promise(() => {}));
  mocked.createTrip.mockReset();
  featured.setMyFeaturing.mockReset().mockResolvedValue(undefined);
  featured.setTripPrivate.mockReset().mockResolvedValue(undefined);
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await markPresentationSeen(SUR); // the first-open presentation would cover the revealed rollo
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
});
afterEach(() => alert.mockRestore());

const confirm = (label: string) =>
  (alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[]).find((b) => b.text === label)!.onPress!();

describe("Rollo: Tus fotos en otros perfiles", () => {
  it("is on by default, with a footnote, on the board before the reveal", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    expect((await screen.findByRole("switch", { name: MINE })).props.value).toBe(true);
    expect(screen.getByText(/Si lo apagás, nadie puede agregar a su perfil las fotos que sacás en este rollo/)).toBeVisible();
  });

  it("shows the saved value", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ allowFeaturing: false }));
    await renderRouter(routes, { initialUrl: "/roll" });

    expect((await screen.findByRole("switch", { name: MINE })).props.value).toBe(false);
  });

  it("turning it off saves it for this rollo and refreshes the rollo", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    await fireEvent(await screen.findByRole("switch", { name: MINE }), "valueChange", false);

    await waitFor(() => expect(featured.setMyFeaturing).toHaveBeenCalledWith(SUR, false));
    await waitFor(() => expect(mocked.fetchTrip.mock.calls.length).toBeGreaterThan(1));
  });

  it("shows the error inline if saving fails", async () => {
    featured.setMyFeaturing.mockRejectedValue(new Error("No hay conexión"));
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    await fireEvent(await screen.findByRole("switch", { name: MINE }), "valueChange", false);

    expect(await screen.findByText("No hay conexión")).toBeVisible();
    expect(screen.getByRole("switch", { name: MINE }).props.value).toBe(true);
  });

  it("is also in the Rollo segment once revealed", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ revealed: true }));
    mocked.fetchFeed.mockResolvedValue({ revealed: true, revealAt: Date.now() - DAY, items: [] });
    await renderRouter(routes, { initialUrl: "/roll?view=roll" });

    expect(await screen.findByRole("switch", { name: MINE })).toBeTruthy();
  });
});

describe("Rollo privado", () => {
  it("the admin sees the switch off by default and can't be tempted by a member's: members don't see it", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ role: "member" }));
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByRole("switch", { name: MINE });
    expect(screen.queryByRole("switch", { name: PRIVATE })).toBeNull();
  });

  it("an admin who is not the creator doesn't see the switch, only the footnote when private", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ role: "admin", isCreator: false, featuringDisabled: true }));
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByText(/Ninguna foto de este rollo sale a perfiles/);
    expect(screen.queryByRole("switch", { name: PRIVATE })).toBeNull();
  });

  it("the creator sees the switch", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ role: "admin", isCreator: true }));
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByRole("switch", { name: PRIVATE })).toBeVisible();
  });

  it("turning it on asks first, then saves for the whole rollo", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    expect((await screen.findByRole("switch", { name: PRIVATE })).props.value).toBe(false);
    await fireEvent(screen.getByRole("switch", { name: PRIVATE }), "valueChange", true);
    expect(alert).toHaveBeenCalledWith(
      "¿Hacer el rollo privado?",
      expect.stringContaining("Se sacan de todos los perfiles"),
      expect.any(Array),
    );
    expect(featured.setTripPrivate).not.toHaveBeenCalled();

    await confirm("Hacer privado");
    await waitFor(() => expect(featured.setTripPrivate).toHaveBeenCalledWith(SUR, true));
  });

  it("cancelling the question saves nothing", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    await fireEvent(await screen.findByRole("switch", { name: PRIVATE }), "valueChange", true);
    expect((alert.mock.calls[0]![2] as { text: string }[]).map((b) => b.text)).toContain("Cancelar");
    expect(featured.setTripPrivate).not.toHaveBeenCalled();
  });

  it("turning it off needs no question", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ featuringDisabled: true }));
    await renderRouter(routes, { initialUrl: "/roll" });

    await fireEvent(await screen.findByRole("switch", { name: PRIVATE }), "valueChange", false);

    await waitFor(() => expect(featured.setTripPrivate).toHaveBeenCalledWith(SUR, false));
    expect(alert).not.toHaveBeenCalled();
  });

  it("in a private rollo the member switch is gone and a footnote says why", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ featuringDisabled: true }));
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByRole("switch", { name: PRIVATE });
    expect(screen.queryByRole("switch", { name: MINE })).toBeNull();
    expect(screen.getByText(/Ninguna foto de este rollo sale a perfiles/)).toBeVisible();
  });
});

describe("Crear rollo: Rollo privado", () => {
  const fillName = async () => fireEvent.changeText(await screen.findByPlaceholderText("Nombre del rollo"), "Sur 2027");

  it("is off by default and explains itself", async () => {
    await renderRouter(routes, { initialUrl: "/create" });

    expect((await screen.findByRole("switch", { name: PRIVATE })).props.value).toBe(false);
    expect(screen.getByText(/Ninguna foto de este rollo sale a perfiles, ni las tuyas/)).toBeVisible();
  });

  it("creates it private when switched on", async () => {
    mocked.createTrip.mockResolvedValue(detail().trip);
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/create" });
    await fillName();
    await fireEvent(await screen.findByRole("switch", { name: PRIVATE }), "valueChange", true);
    await fireEvent.press(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(mocked.createTrip).toHaveBeenCalledWith(expect.objectContaining({ featuringDisabled: true })));
  });

  it("doesn't send the field when it stays off (same request as before)", async () => {
    mocked.createTrip.mockResolvedValue(detail().trip);
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/create" });
    await fillName();
    await fireEvent.press(await screen.findByRole("button", { name: "Crear" }));

    await waitFor(() => expect(mocked.createTrip).toHaveBeenCalled());
    expect(mocked.createTrip.mock.calls[0]![0]).not.toHaveProperty("featuringDisabled");
  });
});
