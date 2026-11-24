import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { Schemas } from "@/api/client";
import type { TripDetail } from "@/features/trips/actions";
import { ApiError } from "@/api/client";
import { useFeed } from "@/features/trips/use-feed";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { deleteFinalist, fetchContest, putFinalist } from "../actions";
import { PicksRow } from "../picks-row";
import { PicksScreen } from "../picks-screen";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../actions");
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(async () => {}) }));
jest.mock("@/features/trips/use-feed", () => ({ useFeed: jest.fn() }));
jest.mock("@/features/trips/use-trip-detail", () => ({ useTripDetail: jest.fn() }));
jest.mock("@/features/media/revealed", () => ({
  ...jest.requireActual("@/features/media/revealed"),
  useMediaToken: () => "tok",
}));

const fetchContestMock = jest.mocked(fetchContest);
const putMock = jest.mocked(putFinalist);
const deleteMock = jest.mocked(deleteFinalist);

const author = { id: "m1", userId: "u1", name: "Ana", username: null, avatarUrl: null };
const photo = (id: string, name = "Ana", groupIds: string[] = []) => ({
  id,
  type: "photo",
  takenAt: 1,
  day: "2027-01-12",
  lat: null,
  lng: null,
  caption: null,
  durationS: null,
  thumbhash: null,
  groupIds,
  author: { ...author, name },
  files: { thumb: `/t/${id}/thumb`, original: `/t/${id}/original`, display: `/t/${id}/display` },
});

const finalist = (mediaId: string): Schemas["ContestFinalist"] => ({
  mediaId,
  author: { userId: "u1", name: "Ana", avatarUrl: null },
  thumbHash: null,
  width: null,
  height: null,
  thumbPath: `/t/${mediaId}/thumb`,
  displayPath: `/t/${mediaId}/display`,
  votes: null,
});

const contest = (finalists: string[]): Schemas["Contest"] => ({
  status: "selecting",
  votingHours: 72,
  closesAt: null,
  finalists: finalists.map(finalist),
  myVote: null,
  winner: null,
  tiedMediaIds: [],
});

function mockFeed(items: unknown[], isRefetching = false) {
  jest.mocked(useFeed).mockReturnValue({ feed: { items }, error: null, loading: false, refetch: jest.fn(), isRefetching } as never);
}

function mockDetail(over: { role?: "admin" | "member"; contestEnabled?: boolean; groups?: { id: string; name: string }[] } = {}) {
  const detail = {
    trip: {
      id: "t1",
      type: "event",
      groups: over.groups ?? [],
      contest: over.contestEnabled === false ? null : { enabled: true, votingHours: 72 },
    },
    me: { role: over.role ?? "admin", groupIds: [] },
  } as never;
  jest.mocked(useTripDetail).mockReturnValue({ detail, error: null, refetch: jest.fn(), isRefetching: false } as never);
  return detail as TripDetail;
}

const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((c) => c.clear());
  clients.length = 0;
});

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDetail();
  mockFeed([photo("p1"), photo("p2", "Beto"), photo("p3", "Cami")]);
  // The server's list: picks and drops change what the next fetch returns.
  const server = new Set(["p1"]);
  fetchContestMock.mockImplementation(async () => contest([...server]));
  putMock.mockImplementation(async (_t, id) => void server.add(id));
  deleteMock.mockImplementation(async (_t, id) => void server.delete(id));
});

describe("PicksScreen", () => {
  it("shows the count and marks the finalists", async () => {
    await wrap(<PicksScreen tripId="t1" />);
    expect(await screen.findByText("1 de 10")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Foto de Ana" }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole("button", { name: "Foto de Beto" }).props.accessibilityState).toEqual({ selected: false });
  });

  it("tapping an unmarked photo picks it and tapping a marked one drops it", async () => {
    await wrap(<PicksScreen tripId="t1" />);
    await screen.findByText("1 de 10");

    await fireEvent.press(screen.getByRole("button", { name: "Foto de Beto" }));
    await waitFor(() => expect(putMock).toHaveBeenCalledWith("t1", "p2"));
    expect(await screen.findByText("2 de 10")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Foto de Ana" }));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("t1", "p1"));
    expect(await screen.findByText("1 de 10")).toBeTruthy();
  });

  it("shows the server's error inline and rolls the pick back", async () => {
    putMock.mockRejectedValue(new ApiError(409, "Ya hay 10 finalistas."));
    await wrap(<PicksScreen tripId="t1" />);
    await screen.findByText("1 de 10");

    await fireEvent.press(screen.getByRole("button", { name: "Foto de Beto" }));

    expect(await screen.findByText("Ya hay 10 finalistas.")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Foto de Beto" }).props.accessibilityState).toEqual({ selected: false }));
    expect(screen.getByText("1 de 10")).toBeTruthy();
  });

  it("waits for the refetch when the cached feed has photos without files, instead of saying there are none", async () => {
    const stale = { id: "p1", type: "photo", takenAt: 1, day: "2027-01-12", author, groupIds: [] };
    mockFeed([stale], true);
    await wrap(<PicksScreen tripId="t1" />);
    await waitFor(() => expect(fetchContestMock).toHaveBeenCalled());
    expect(screen.queryByText("No hay fotos para elegir")).toBeNull();
    expect(screen.queryByText("1 de 10")).toBeNull();
  });

  it("says there are no photos only when the feed has no photo items", async () => {
    mockFeed([]);
    await wrap(<PicksScreen tripId="t1" />);
    expect(await screen.findByText("No hay fotos para elegir")).toBeTruthy();
  });

  it("says the event has no contest instead of spinning", async () => {
    mockDetail({ contestEnabled: false });
    await wrap(<PicksScreen tripId="t1" />);
    expect(await screen.findByText("Este evento no tiene concurso.")).toBeTruthy();
  });

  it("does not let a guest pick", async () => {
    mockDetail({ role: "member" });
    await wrap(<PicksScreen tripId="t1" />);
    expect(await screen.findByText("Solo quienes organizan eligen las finalistas.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Foto de Ana" })).toBeNull();
  });
});

describe("PicksRow", () => {
  it("shows 'Elegí las finalistas' with the count and opens the picks screen", async () => {
    await wrap(<PicksRow detail={mockDetail()} phase="ended" />);
    const button = await screen.findByRole("button", { name: "Elegí las finalistas, 1 de 10" });
    await fireEvent.press(button);
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/contest-picks", params: { trip: "t1" } });
  });

  it("is hidden for guests, without contest and outside the window, without asking the server", async () => {
    await wrap(<PicksRow detail={mockDetail({ role: "member" })} phase="ended" />);
    await wrap(<PicksRow detail={mockDetail({ contestEnabled: false })} phase="ended" />);
    await wrap(<PicksRow detail={mockDetail()} phase="active" />);
    await wrap(<PicksRow detail={mockDetail()} phase="revealed" />);
    expect(screen.queryByText("Elegí las finalistas")).toBeNull();
    expect(fetchContestMock).not.toHaveBeenCalled();
  });
});
