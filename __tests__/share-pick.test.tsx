import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { getCollageSelection, setCollageSelection } from "@/features/share/collage-selection";
import { SharePickScreen } from "@/features/share/share-pick-screen";
import * as tripActions from "@/features/trips/actions";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" } }));
const trips = jest.mocked(tripActions);
const haptics = jest.mocked(Haptics);

const SUR = "11111111-1111-4111-8111-111111111111";
const ids = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);

const item = (id: string): tripActions.Feed["items"][number] => ({
  groupIds: [],
  id,
  type: "photo",
  takenAt: Date.parse("2027-01-12T16:10:00Z"),
  day: "2027-01-12",
  lat: null,
  lng: null,
  caption: null,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  durationS: null,
  author: { id: "m2", userId: "u-m2", name: "Fede", username: null, avatarUrl: null },
  width: 4000,
  height: 3000,
  shareable: true,
  files: { thumb: `/m/${id}/thumb`, original: `/m/${id}/original` },
});

async function open(selection: string[] = []) {
  setCollageSelection(SUR, selection);
  trips.fetchFeedPage.mockResolvedValue({ revealed: true, revealAt: Date.now() - 1000, items: ids.map(item), nextCursor: null });
  await renderRouter(
    { ...routes, "share-pick": () => <SharePickScreen tripId={SUR} /> },
    { initialUrl: "/blocked" },
  );
  await act(async () => router.push("/share-pick"));
  await screen.findByTestId("pick-cell-p1");
}

const cell = (id: string) => screen.getByTestId(`pick-cell-${id}`);
const badge = (id: string) => screen.queryByTestId(`pick-badge-${id}`);

beforeEach(async () => {
  jest.clearAllMocks();
  for (const mock of Object.values(trips)) (mock as Partial<jest.Mock>).mockReset?.();
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
});

describe("Elegir fotos", () => {
  it("numbers the cells in tap order and shows the counter", async () => {
    await open();
    expect(screen.getByText("0 de 8")).toBeVisible();
    await fireEvent.press(cell("p3"));
    await fireEvent.press(cell("p1"));
    expect(badge("p3")).toHaveTextContent("1");
    expect(badge("p1")).toHaveTextContent("2");
    expect(badge("p2")).toBeNull();
    expect(screen.getByText("2 de 8")).toBeVisible();
  });

  it("deselecting renumbers the rest", async () => {
    await open();
    await fireEvent.press(cell("p1"));
    await fireEvent.press(cell("p2"));
    await fireEvent.press(cell("p3"));
    await fireEvent.press(cell("p1"));
    expect(badge("p1")).toBeNull();
    expect(badge("p2")).toHaveTextContent("1");
    expect(badge("p3")).toHaveTextContent("2");
  });

  it("a 9th tap is ignored and fires a haptic", async () => {
    await open();
    for (const id of ids.slice(0, 8)) await fireEvent.press(cell(id));
    expect(haptics.impactAsync).not.toHaveBeenCalled();
    await fireEvent.press(cell("p9"));
    expect(badge("p9")).toBeNull();
    expect(screen.getByText("8 de 8")).toBeVisible();
    expect(haptics.impactAsync).toHaveBeenCalledWith("light");
  });

  it("Listo saves the draft and goes back", async () => {
    await open();
    await fireEvent.press(cell("p2"));
    await fireEvent.press(cell("p1"));
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    expect(getCollageSelection(SUR)).toEqual(["p2", "p1"]);
    expect(screen).toHavePathname("/blocked");
  });

  it("Cancelar goes back without saving", async () => {
    await open(["p4"]);
    expect(badge("p4")).toHaveTextContent("1");
    await fireEvent.press(cell("p1"));
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }));
    expect(getCollageSelection(SUR)).toEqual(["p4"]);
    expect(screen).toHavePathname("/blocked");
  });
});
