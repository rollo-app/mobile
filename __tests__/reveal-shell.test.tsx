import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Dimensions, StyleSheet, Text } from "react-native";
import * as profileActions from "@/features/profile/actions";
import * as actions from "@/features/trips/actions";
import { hasSeenPresentation, markPresentationSeen } from "@/storage/presentation";
import { getActiveTripId, setActiveTripId } from "@/storage/active-trip";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";
import { RollDates } from "@/features/roll/roll-dates";
import { UploadStatusSection } from "@/features/capture/upload-status-section";
import { colors, spacing } from "@/ui/theme";
// The navigation bar is drawn natively: its options are read from the container instead.
import { navigationRef } from "expo-router/build/global-state/navigationRef";

jest.mock("@/features/trips/actions");
// Pass-throughs, so the tests can see which screens render the shared dates and the uploads.
jest.mock("@/features/roll/roll-dates", () => {
  const actual = jest.requireActual("@/features/roll/roll-dates");
  return { ...actual, RollDates: jest.fn(actual.RollDates) };
});
jest.mock("@/features/capture/upload-status-section", () => {
  const actual = jest.requireActual("@/features/capture/upload-status-section");
  return { ...actual, UploadStatusSection: jest.fn(actual.UploadStatusSection) };
});
const mocked = jest.mocked(actions);

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";

const detail = (over: Partial<actions.TripDetail["trip"]> = {}): actions.TripDetail => ({
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
    ...over,
  },
  me: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false },
  members: [{ id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin", blockedByMe: false }],
  today: { date: "2027-01-12", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 3,
});

const session = (active = SUR) =>
  signInAs({ trips: [tripSummary(SUR, "Viaje al sur"), tripSummary(OTRO, "Bariloche")], active });

const testRoutes = { ...routes, "photo/[id]": () => <Text>Foto</Text> };

beforeEach(async () => {
  jest.clearAllMocks();
  mocked.fetchFeed.mockResolvedValue({ revealed: true, revealAt: Date.now() - DAY, items: [] });
  await session();
});

describe("revealed roll", () => {
  it("the header title follows the active trip when it switches to a revealed one", async () => {
    const upcoming = detail({ revealed: false, startsAt: Date.now() + DAY, endsAt: Date.now() + 2 * DAY, revealAt: Date.now() + 3 * DAY });
    mocked.fetchTrip.mockImplementation(async (id: string) =>
      id === SUR ? upcoming : detail({ id: OTRO, name: "Bariloche" }),
    );
    await markPresentationSeen(OTRO);
    await setActiveTripId(OTRO);
    await renderRouter(testRoutes, { initialUrl: "/roll" });
    // The Rollo tab's header comes first in the tree (the Mapa tab has its own title).
    const rollTitle = () => screen.getAllByLabelText(/, cambiar de rollo$/)[0]?.props.accessibilityLabel;
    // Open the revealed trip first so its detail is cached and the switch back to it is instant.
    await screen.findByText("Este rollo no tiene fotos");

    await act(async () => {
      await setActiveTripId(SUR);
    });
    await waitFor(() => expect(screen.queryByText("Fechas")).not.toBeNull());
    expect(rollTitle()).toBe("Viaje al sur, cambiar de rollo");

    await act(async () => {
      await setActiveTripId(OTRO);
    });

    await waitFor(() => expect(screen.queryByText("Este rollo no tiene fotos")).not.toBeNull());
    expect(rollTitle()).toBe("Bariloche, cambiar de rollo");
  });

  it("the gallery header title is narrower than the board's so it clears the toolbar", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await markPresentationSeen(SUR);
    await renderRouter(testRoutes, { initialUrl: "/roll" });
    await screen.findByText("Este rollo no tiene fotos");

    const button = screen.getAllByLabelText(/, cambiar de rollo$/)[0]!;
    const style = StyleSheet.flatten(typeof button.props.style === "function" ? button.props.style({ pressed: false }) : button.props.style);
    expect(style.maxWidth).toBe(Dimensions.get("window").width * 0.45);
  });

  it("opens the reveal automatically the first time, and only once", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    mocked.fetchFeed.mockResolvedValue({
      revealed: true,
      revealAt: Date.now() - DAY,
      items: [
        {
          id: "a", type: "photo", takenAt: Date.now() - DAY, day: "2027-01-12", lat: null, lng: null, caption: null,
          thumbhash: null, durationS: null, author: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null },
          files: { thumb: "/m/a/thumb", original: "/m/a/original" },
        },
      ],
    });
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    expect(await screen.findByTestId("reveal-surface")).toBeTruthy();
    expect(screen).toHavePathname("/reveal");
    expect(await hasSeenPresentation(SUR)).toBe(true);
  });

  it("doesn't open it again once seen", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await markPresentationSeen(SUR);
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    await screen.findByText("Este rollo no tiene fotos");
    expect(screen).toHavePathname("/roll");
  });

  it("an ended roll that isn't revealed keeps the board and doesn't open the presentation", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ revealed: false, revealAt: Date.now() + DAY }));
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    expect(await screen.findByText("Fechas")).toBeVisible();
    expect(screen).toHavePathname("/roll");
  });
});

const item = (id: string, type: "photo" | "video") => ({
  id, type, takenAt: Date.now() - 3 * DAY, day: "2027-01-12", lat: null, lng: null, caption: null,
  thumbhash: null, durationS: type === "video" ? 9 : null,
  author: { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null },
  files: { thumb: `/m/${id}/thumb`, original: `/m/${id}/original` },
});

describe("revealed roll: Galería | Rollo", () => {
  const revealedWithMedia = async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    mocked.fetchFeed.mockResolvedValue({ revealed: true, revealAt: Date.now() - DAY, items: [item("a", "photo"), item("b", "video")] });
    await markPresentationSeen(SUR);
  };

  it("before the reveal there's no segmented control and the board shows the shared dates", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ revealed: false, revealAt: Date.now() + DAY }));
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    expect(await screen.findByText("Fechas")).toBeVisible();
    expect(jest.mocked(RollDates)).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Galería" })).toBeNull();
  });

  it("after the reveal the gallery comes first, under a Galería | Rollo control", async () => {
    await revealedWithMedia();
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    expect(await screen.findByTestId("gallery-list")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Galería" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Rollo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Seleccionar" })).toBeTruthy();
    expect(screen.queryByText("Fechas")).toBeNull();
  });

  // The header is opaque, so the row sits in the normal flow right under it, and nothing pads the views' tops.
  it("puts the Galería | Rollo row in the flow under the header, and the gallery right below it", async () => {
    await revealedWithMedia();
    await renderRouter(testRoutes, { initialUrl: "/roll" });
    const list = await screen.findByTestId("gallery-list");

    const row = StyleSheet.flatten(screen.getByTestId("revealed-roll-controls").props.style);
    expect(row).toMatchObject({ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background });
    expect(row.position).toBeUndefined();
    expect(row.top).toBeUndefined();
    expect(StyleSheet.flatten(list.props.contentContainerStyle).paddingTop).toBeUndefined();
  });

  it("'Rollo' starts right below the row, on the grouped background", async () => {
    await revealedWithMedia();
    await renderRouter(testRoutes, { initialUrl: "/roll?view=roll" });
    await screen.findByText("Invitar");

    const row = StyleSheet.flatten(screen.getByTestId("revealed-roll-controls").props.style);
    expect(row.backgroundColor).toBe(colors.groupedBackground);
    const overview = StyleSheet.flatten(screen.getByTestId("roll-overview").props.contentContainerStyle);
    expect(overview).toMatchObject({ padding: spacing.md });
    expect(overview.paddingTop).toBeUndefined();
  });

  it("after the reveal the header is solid with the same background as the row, without a hairline", async () => {
    await revealedWithMedia();
    await renderRouter(testRoutes, { initialUrl: "/roll" });
    await screen.findByTestId("gallery-list");

    await waitFor(() =>
      expect(navigationRef.getCurrentOptions()).toEqual(
        expect.objectContaining({
          headerTransparent: false,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerBlurEffect: "none",
          headerLargeTitle: false,
        }),
      ),
    );
  });

  it("before the reveal the header keeps its default look", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ revealed: false, revealAt: Date.now() + DAY }));
    await renderRouter(testRoutes, { initialUrl: "/roll" });
    await screen.findByText("Fechas");

    const options = navigationRef.getCurrentOptions() as Record<string, unknown>;
    for (const key of ["headerTransparent", "headerStyle", "headerShadowVisible", "headerBlurEffect", "headerLargeTitle"])
      expect(options[key]).toBeUndefined();
  });

  it("the gallery menu no longer has 'Sobre el rollo'", async () => {
    await revealedWithMedia();
    await renderRouter(testRoutes, { initialUrl: "/roll" });

    expect(await screen.findByRole("menuitem", { name: "Guardar todo en Fotos" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Sobre el rollo" })).toBeNull();
  });

  it("'Rollo' shows the summary, the dates, the uploads and the members, without the gallery toolbar", async () => {
    await revealedWithMedia();
    await renderRouter(testRoutes, { initialUrl: "/roll" });
    await screen.findByTestId("gallery-list");
    jest.mocked(RollDates).mockClear();

    await fireEvent.press(screen.getByRole("button", { name: "Rollo" }));

    expect(screen).toHaveSearchParams({ view: "roll" });
    expect(await screen.findByText("1 foto · 1 video · 1 persona · 4 días")).toBeVisible();
    expect(screen.getByText("Fechas")).toBeVisible();
    expect(screen.getByText("Se reveló")).toBeVisible();
    expect(jest.mocked(RollDates)).toHaveBeenCalled();
    expect(jest.mocked(UploadStatusSection)).toHaveBeenCalledWith(expect.objectContaining({ tripId: SUR }), undefined);
    expect(screen.getByText("Invitar")).toBeVisible();
    expect(screen.getByText("HUB5FT")).toBeVisible();
    expect(screen.getByText("En el rollo · 1")).toBeVisible();
    expect(screen.queryByText("Hoy")).toBeNull();
    expect(screen.queryByRole("button", { name: "Seleccionar" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Guardar todo en Fotos" })).toBeNull();
  });

  it("going back to 'Galería' keeps the same gallery mounted", async () => {
    await revealedWithMedia();
    await renderRouter(testRoutes, { initialUrl: "/roll" });
    const list = await screen.findByTestId("gallery-list");

    await fireEvent.press(screen.getByRole("button", { name: "Rollo" }));
    await screen.findByText("Invitar");
    await fireEvent.press(screen.getByRole("button", { name: "Galería" }));

    expect(screen.getByTestId("gallery-list")).toBe(list);
    expect(screen.queryByText("Invitar")).toBeNull();
    expect(screen.getByRole("button", { name: "Seleccionar" })).toBeTruthy();
  });

  it("/roll?view=roll opens straight on 'Rollo'", async () => {
    await revealedWithMedia();
    await renderRouter(testRoutes, { initialUrl: "/roll?view=roll" });

    expect(await screen.findByText("Invitar")).toBeVisible();
    expect(screen.getByText("1 foto · 1 video · 1 persona · 4 días")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Seleccionar" })).toBeNull();
  });

  it("tapping a member in 'Rollo' opens their profile", async () => {
    const fetchUser = jest.spyOn(profileActions, "fetchUser").mockResolvedValue({
      user: { id: "u-m2", name: "Fede", username: "fede", avatarUrl: null, bio: null, badge: null },
      isFriend: false,
      blockedByMe: false,
      reportedByMe: false,
      profileVisibility: "friends",
      canSee: false,
      friendCount: 0,
      mutualCount: 0,
      friendRequest: "none",
    });
    const base = detail();
    const fede = { id: "m2", userId: "u-m2", name: "Fede", username: "fede", avatarUrl: null, role: "member" as const, blockedByMe: false };
    mocked.fetchTrip.mockResolvedValue({ ...base, members: [...base.members, fede] });
    await markPresentationSeen(SUR);
    await renderRouter(testRoutes, { initialUrl: "/roll?view=roll" });

    await fireEvent.press(await screen.findByRole("button", { name: "Fede" }));

    await waitFor(() => expect(screen).toHavePathname("/user/u-m2"));
    expect(await screen.findByText("Este perfil es privado")).toBeVisible();
    fetchUser.mockRestore();
  });
});
