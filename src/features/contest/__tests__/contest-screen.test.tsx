import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { Schemas } from "@/api/client";
import { ApiError } from "@/api/client";
import { useMe } from "@/features/auth/use-me";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { deleteVote, fetchContest, putVote, putWinner } from "../actions";
import { ContestCard } from "../contest-card";
import { ContestScreen } from "../contest-screen";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../actions");
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(async () => {}), notificationAsync: jest.fn(async () => {}), NotificationFeedbackType: { Success: "success" } }));
jest.mock("@/features/trips/use-trip-detail", () => ({ useTripDetail: jest.fn() }));
jest.mock("@/features/auth/use-me", () => ({ useMe: jest.fn() }));
jest.mock("@/features/media/revealed", () => ({
  ...jest.requireActual("@/features/media/revealed"),
  useMediaToken: () => "tok",
}));

const fetchMock = jest.mocked(fetchContest);
const voteMock = jest.mocked(putVote);
const unvoteMock = jest.mocked(deleteVote);
const winnerMock = jest.mocked(putWinner);

const finalist = (mediaId: string, userId: string, name: string, votes: number | null = null): Schemas["ContestFinalist"] => ({
  mediaId,
  author: { userId, name, avatarUrl: null },
  thumbHash: null,
  width: null,
  height: null,
  thumbPath: `/c/${mediaId}/thumb`,
  displayPath: `/c/${mediaId}/display`,
  votes,
});

const FINALISTS = [finalist("m1", "u1", "Ana"), finalist("m2", "u2", "Beto"), finalist("m3", "u3", "Cami")];

const contest = (over: Partial<Schemas["Contest"]> = {}): Schemas["Contest"] => ({
  status: "voting",
  votingHours: 72,
  closesAt: Date.now() + 2 * 24 * 3_600_000 + 3_600_000,
  finalists: FINALISTS,
  myVote: null,
  winner: null,
  tiedMediaIds: [],
  ...over,
});

function mockDetail(role: "admin" | "member" = "member", enabled = true) {
  jest.mocked(useTripDetail).mockReturnValue({
    detail: { trip: { id: "t1", type: "event", contest: enabled ? { enabled: true, votingHours: 72 } : null }, me: { role, groupIds: [] } },
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  } as never);
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

let server: Schemas["Contest"];
beforeEach(() => {
  jest.clearAllMocks();
  mockDetail();
  jest.mocked(useMe).mockReturnValue({ me: { id: "u1" } } as never);
  server = contest();
  fetchMock.mockImplementation(async () => server);
  voteMock.mockImplementation(async (_t, id) => void (server = { ...server, myVote: id }));
  unvoteMock.mockImplementation(async () => void (server = { ...server, myVote: null }));
  winnerMock.mockResolvedValue(undefined);
});

const open = async (author: string) => {
  await fireEvent.press(await screen.findByRole("button", { name: `Foto de ${author}` }));
};

describe("ContestScreen without contest", () => {
  it("says the event has no contest instead of spinning", async () => {
    mockDetail("member", false);
    await wrap(<ContestScreen tripId="t1" />);
    expect(await screen.findByText("Este evento no tiene concurso.")).toBeTruthy();
  });
});

describe("ContestScreen voting", () => {
  it("voting calls the action and shows 'Tu voto'", async () => {
    await wrap(<ContestScreen tripId="t1" />);
    await open("Beto");
    await fireEvent.press(await screen.findByRole("button", { name: "Votar esta" }));
    await waitFor(() => expect(voteMock).toHaveBeenCalledWith("t1", "m2"));
    expect(await screen.findByRole("button", { name: "Tu voto ✓" })).toBeTruthy();
  });

  it("tapping 'Tu voto' takes the vote back", async () => {
    server = contest({ myVote: "m2" });
    await wrap(<ContestScreen tripId="t1" />);
    await open("Beto");
    await fireEvent.press(await screen.findByRole("button", { name: "Tu voto ✓" }));
    await waitFor(() => expect(unvoteMock).toHaveBeenCalledWith("t1"));
    expect(await screen.findByRole("button", { name: "Votar esta" })).toBeTruthy();
  });

  it("your own photo can't be voted", async () => {
    await wrap(<ContestScreen tripId="t1" />);
    await open("Ana");
    const button = await screen.findByRole("button", { name: "Votar esta" });
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(button.props.accessibilityHint).toBe("No podés votar tu propia foto");
    await fireEvent.press(button);
    expect(voteMock).not.toHaveBeenCalled();
  });

  it("shows the server's refusal inline and rolls the vote back", async () => {
    voteMock.mockRejectedValue(new ApiError(409, "La votación no está abierta."));
    await wrap(<ContestScreen tripId="t1" />);
    await open("Beto");
    await fireEvent.press(await screen.findByRole("button", { name: "Votar esta" }));
    expect(await screen.findByText("La votación no está abierta.")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Votar esta" })).toBeTruthy());
  });

  it("while closing, voting is off", async () => {
    server = contest({ status: "closing" });
    await wrap(<ContestScreen tripId="t1" />);
    expect(await screen.findByText("Cerrando la votación…")).toBeTruthy();
    await open("Beto");
    expect((await screen.findByRole("button", { name: "Votar esta" })).props.accessibilityState.disabled).toBe(true);
  });
});

describe("ContestScreen tie", () => {
  const tied = () => contest({ status: "tied", tiedMediaIds: ["m2", "m3", "gone"] });

  it("an organizer picks the winner after confirming", async () => {
    mockDetail("admin");
    server = tied();
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await wrap(<ContestScreen tripId="t1" />);
    const buttons = await screen.findAllByRole("button", { name: "Elegir ganadora" });
    expect(buttons).toHaveLength(2);
    await fireEvent.press(buttons[0]!);
    expect(alert).toHaveBeenCalledTimes(1);
    const confirm = alert.mock.calls[0]![2]!.find((b) => b.style !== "cancel")!;
    confirm.onPress!();
    await waitFor(() => expect(winnerMock).toHaveBeenCalledWith("t1", expect.stringMatching(/^m[23]$/)));
  });

  it("a guest only sees the note", async () => {
    server = tied();
    await wrap(<ContestScreen tripId="t1" />);
    expect(await screen.findByText("Hay un empate. Los organizadores eligen la ganadora.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Elegir ganadora" })).toBeNull();
  });
});

describe("ContestScreen result", () => {
  it("closed: the winner on top and the votes of each finalist", async () => {
    server = contest({
      status: "closed",
      finalists: [finalist("m1", "u1", "Ana", 1), finalist("m2", "u2", "Beto", 5), finalist("m3", "u3", "Cami", 0)],
      winner: { mediaId: "m2", author: { userId: "u2", name: "Beto", avatarUrl: null }, imageAvailable: true },
    });
    await wrap(<ContestScreen tripId="t1" />);
    expect(await screen.findByText("Ganó la foto de Beto")).toBeTruthy();
    expect(screen.getByText("5 votos")).toBeTruthy();
    expect(screen.getByText("1 voto")).toBeTruthy();
    expect(screen.getByText("0 votos")).toBeTruthy();
  });

  it("cancelled", async () => {
    server = contest({ status: "cancelled", closesAt: null, finalists: [] });
    await wrap(<ContestScreen tripId="t1" />);
    expect(await screen.findByText("El concurso se canceló.")).toBeTruthy();
  });
});

describe("ContestCard", () => {
  it("voting: opens the contest", async () => {
    await wrap(<ContestCard tripId="t1" enabled />);
    const card = await screen.findByRole("button", { name: /Concurso de fotos · Cierra en 2 días/ });
    await fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/contest", params: { trip: "t1" } });
  });

  it("closed: the winner's name", async () => {
    server = contest({ status: "closed", winner: { mediaId: "m2", author: { userId: "u2", name: "Beto", avatarUrl: null }, imageAvailable: true } });
    await wrap(<ContestCard tripId="t1" enabled />);
    expect(await screen.findByText("Ganó la foto de Beto")).toBeTruthy();
  });

  it("nothing for events without a contest", async () => {
    await wrap(<ContestCard tripId="t1" enabled={false} />);
    expect(screen.queryByText(/Concurso de fotos/)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
