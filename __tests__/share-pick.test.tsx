import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { collageCandidates, pickCollage } from "@/features/share/collage";
import { getCollageSelection, setCollageSelection } from "@/features/share/collage-selection";
import { getFilmSelection, setFilmSelection, setFilmShown } from "@/features/share/film-selection";
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

async function open(selection: string[] = [], seed?: number) {
  setCollageSelection(SUR, selection);
  trips.fetchFeedPage.mockResolvedValue({ revealed: true, revealAt: Date.now() - 1000, items: ids.map(item), nextCursor: null });
  await renderRouter(
    { ...routes, "share-pick": () => <SharePickScreen tripId={SUR} seed={seed} /> },
    { initialUrl: "/blocked" },
  );
  await act(async () => router.push(seed === undefined ? "/share-pick" : { pathname: "/share-pick", params: { seed: String(seed) } }));
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
    expect(screen.getByText("En el collage · 0 de 8")).toBeVisible();
    await fireEvent.press(cell("p3"));
    await fireEvent.press(cell("p1"));
    expect(badge("p3")).toHaveTextContent("1");
    expect(badge("p1")).toHaveTextContent("2");
    expect(badge("p2")).toBeNull();
    expect(screen.getByText("En el collage · 2 de 8")).toBeVisible();
  });

  it("labels each photo with its position and, when chosen, its number", async () => {
    await open();
    expect(screen.getByLabelText("Foto 3 de 10")).toBeVisible();
    await fireEvent.press(cell("p3"));
    expect(screen.getByLabelText("Foto 3 de 10, elegida 1")).toBeVisible();
    expect(screen.getByLabelText("Foto 4 de 10")).toBeVisible();
  });

  it("ignores saved ids that are no longer candidates", async () => {
    await open(["gone", "p2"]);
    expect(screen.getByText("En el collage · 1 de 8")).toBeVisible();
    expect(badge("p2")).toHaveTextContent("1");
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    expect(getCollageSelection(SUR)).toEqual(["p2"]);
  });

  it("keeps a saved id from a page that has not loaded yet", async () => {
    setCollageSelection(SUR, ["p10"]);
    let resolveSecond!: (feed: tripActions.Feed) => void;
    const base = { revealed: true, revealAt: Date.now() - 1000 };
    trips.fetchFeedPage
      .mockResolvedValueOnce({ ...base, items: ids.slice(0, 5).map(item), nextCursor: "c2" })
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));
    await renderRouter({ ...routes, "share-pick": () => <SharePickScreen tripId={SUR} /> }, { initialUrl: "/blocked" });
    await act(async () => router.push("/share-pick"));
    await screen.findByTestId("pick-cell-p1");
    expect(screen.queryByTestId("pick-cell-p10")).toBeNull();
    expect(screen.getByText("En el collage · 1 de 8")).toBeVisible();
    await act(async () => resolveSecond({ ...base, items: ids.slice(5).map(item), nextCursor: null }));
    expect(await screen.findByTestId("pick-badge-p10")).toHaveTextContent("1");
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    expect(getCollageSelection(SUR)).toEqual(["p10"]);
  });

  it("with nothing saved, opens with the collage photos already numbered in collage order and Listo saves them", async () => {
    const shown = pickCollage(collageCandidates(ids.map((id) => ({ id, shareable: true }) as never)), 1).map((p) => p.id);
    await open([], 1);
    await screen.findByText(`En el collage · ${shown.length} de 8`);
    shown.forEach((id, i) => expect(badge(id)).toHaveTextContent(String(i + 1)));
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    expect(getCollageSelection(SUR)).toEqual(shown);
  });

  it("with a saved selection, shows that selection and not the collage pick", async () => {
    await open(["p4"], 1);
    expect(badge("p4")).toHaveTextContent("1");
    expect(screen.getByText("En el collage · 1 de 8")).toBeVisible();
  });

  it("shows the tray in selection order with its label", async () => {
    await open();
    await fireEvent.press(cell("p5"));
    await fireEvent.press(cell("p2"));
    await fireEvent.press(cell("p9"));
    expect(screen.getByText("En el collage · 3 de 8")).toBeVisible();
    const tray = screen.getAllByLabelText(/^Quitar foto \d del collage$/);
    expect(tray.map((node) => node.props.testID)).toEqual(["pick-tray-p5", "pick-tray-p2", "pick-tray-p9"]);
    expect(screen.getByTestId("pick-tray-badge-p9")).toHaveTextContent("3");
  });

  it("shows 8 minus n empty slots", async () => {
    await open();
    expect(screen.getAllByTestId("pick-tray-empty")).toHaveLength(8);
    await fireEvent.press(cell("p1"));
    await fireEvent.press(cell("p2"));
    expect(screen.getAllByTestId("pick-tray-empty")).toHaveLength(6);
    for (const id of ids.slice(2, 8)) await fireEvent.press(cell(id));
    expect(screen.queryAllByTestId("pick-tray-empty")).toHaveLength(0);
  });

  it("tapping a tray item deselects it and renumbers the rest", async () => {
    await open();
    await fireEvent.press(cell("p1"));
    await fireEvent.press(cell("p2"));
    await fireEvent.press(cell("p3"));
    await fireEvent.press(screen.getByLabelText("Quitar foto 1 del collage"));
    expect(badge("p1")).toBeNull();
    expect(badge("p2")).toHaveTextContent("1");
    expect(badge("p3")).toHaveTextContent("2");
    expect(screen.getByText("En el collage · 2 de 8")).toBeVisible();
    expect(screen.getByTestId("pick-tray-badge-p3")).toHaveTextContent("2");
    expect(screen.queryByTestId("pick-tray-p1")).toBeNull();
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
    expect(screen.getByText("En el collage · 8 de 8")).toBeVisible();
    expect(haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(haptics.impactAsync).toHaveBeenCalledTimes(1);
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

describe("Elegir fotos for the recorrido", () => {
  const located = (id: string) => ({ ...item(id), lat: -41.13, lng: -71.31 });
  const many = Array.from({ length: 17 }, (_, i) => `q${i + 1}`);

  async function openJourney() {
    setCollageSelection(SUR, []);
    setFilmSelection(SUR, []);
    trips.fetchFeedPage.mockResolvedValue({
      revealed: true,
      revealAt: Date.now() - 1000,
      items: [...many.map(located), item("nogeo")],
      nextCursor: null,
    });
    await renderRouter({ ...routes, "share-pick": () => <SharePickScreen tripId={SUR} kind="journey" /> }, { initialUrl: "/blocked" });
    await act(async () => router.push("/share-pick"));
    await screen.findByTestId("pick-cell-q1");
  }

  it("does not offer a photo without coordinates", async () => {
    await openJourney();
    expect(screen.queryByTestId("pick-cell-nogeo")).toBeNull();
  });

  it("refuses the 16th tap and writes the film selection, not the collage's", async () => {
    setFilmShown(SUR, []);
    await openJourney();
    await screen.findByText("En el recorrido · 15 de 15");
    // Starts from the photos the film shows (15 at most): drop one, then the cap lets exactly one more in.
    for (const id of many.slice(0, 15)) expect(badge(id)).toHaveTextContent("✓");
    await fireEvent.press(cell("q16"));
    expect(badge("q16")).toBeNull();
    expect(haptics.impactAsync).toHaveBeenCalledTimes(1);
    await fireEvent.press(cell("q1"));
    await fireEvent.press(cell("q16"));
    expect(badge("q16")).toHaveTextContent("✓");
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    expect(getFilmSelection(SUR)).toEqual(expect.arrayContaining(["q16", "q2"]));
    expect(getFilmSelection(SUR)).toHaveLength(15);
    expect(getCollageSelection(SUR)).toEqual([]);
  });

  it("starts from the photos the film shows now, so Listo without touching anything keeps the film", async () => {
    setFilmShown(SUR, ["q3", "q9", "q16"]);
    await openJourney();
    await screen.findByText("En el recorrido · 3 de 15");
    expect(badge("q3")).toHaveTextContent("✓");
    expect(badge("q1")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    expect(getFilmSelection(SUR)).toEqual(["q3", "q9", "q16"]);
  });
});

