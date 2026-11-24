import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import type { Schemas } from "@/api/client";
import { useMe } from "@/features/auth/use-me";
import { hasSeenContestWinner, markContestWinnerSeen } from "@/storage/contest-winner-seen";
import { useThumbBytes } from "@/features/darkroom/use-thumb-bytes";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import "@/test/reanimated";
import { fetchContest } from "../actions";
import { useWinnerReveal } from "../use-winner-reveal";
import { WinnerRevealScreen } from "../winner-reveal-screen";

const mockPush = jest.fn();
const mockDismissTo = jest.fn();
jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useRouter: () => ({ push: mockPush, dismissTo: mockDismissTo, replace: jest.fn() }),
}));
// Reanimated's real module needs the native worklets runtime and throws on import under Jest: an empty object that
// `@/test/reanimated` (imported above) fills with the hooks these screens use. Route suites get it from
// expo-router/testing-library, which this unit test doesn't load.
jest.mock("react-native-reanimated", () => ({}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("expo-haptics", () => ({ notificationAsync: jest.fn(async () => {}), NotificationFeedbackType: { Success: "success" } }));
// The develop effect (Skia) is a marker View with testID "develop-image" (jest.setup).
jest.mock("@/features/darkroom/use-thumb-bytes", () => ({ useThumbBytes: jest.fn() }));
jest.mock("@/ui/use-reduce-motion", () => ({ useReduceMotion: jest.fn(() => false) }));
jest.mock("../actions");
jest.mock("@/features/auth/use-me", () => ({ useMe: jest.fn() }));
jest.mock("@/features/media/revealed", () => ({
  ...jest.requireActual("@/features/media/revealed"),
  useMediaToken: () => "tok",
}));

const finalist = (mediaId: string, userId: string, name: string, username: string | null, votes: number): Schemas["ContestFinalist"] => ({
  mediaId,
  author: { userId, name, username, avatarUrl: null },
  thumbHash: null,
  width: 3,
  height: 4,
  thumbPath: `/c/${mediaId}/thumb`,
  displayPath: `/c/${mediaId}/display`,
  votes,
});

const closed = (over: { username?: string | null; imageAvailable?: boolean } = {}): Schemas["Contest"] => {
  const username = over.username === undefined ? "cami" : over.username;
  return {
    status: "closed",
    votingHours: 72,
    closesAt: Date.now() - 1000,
    finalists: [finalist("m1", "u1", "Ana", null, 3), finalist("m2", "u2", "Cami", username, 12)],
    myVote: null,
    winner: { mediaId: "m2", author: { userId: "u2", name: "Cami", username, avatarUrl: null }, imageAvailable: over.imageAvailable ?? true },
    tiedMediaIds: [],
  };
};

const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((c) => c.clear());
  clients.length = 0;
});
function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useMe).mockReturnValue({ me: { id: "u1" } } as never);
  jest.mocked(useReduceMotion).mockReturnValue(false);
  jest.mocked(useThumbBytes).mockReturnValue({ bytes: { m2: new ArrayBuffer(8) }, settled: true });
});

function Opener({ contest }: { contest: Schemas["Contest"] | null }) {
  useWinnerReveal("t1", contest);
  return null;
}

describe("useWinnerReveal", () => {
  it("opens the reveal once and remembers it", async () => {
    await render(<Opener contest={closed()} />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/contest-winner?trip=t1"));
    expect(await hasSeenContestWinner("t1")).toBe(true);

    mockPush.mockClear();
    await render(<Opener contest={closed()} />);
    await act(async () => {});
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("opens it only once when the card and the screen mount together", async () => {
    await render(
      <>
        <Opener contest={closed()} />
        <Opener contest={closed()} />
      </>,
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    await act(async () => {});
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("doesn't open without a winner or before the contest closes", async () => {
    await render(<Opener contest={{ ...closed(), winner: null }} />);
    await render(<Opener contest={{ ...closed(), status: "tied", winner: null }} />);
    await render(<Opener contest={{ ...closed(), status: "voting" }} />);
    await render(<Opener contest={null} />);
    await act(async () => {});
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("doesn't open (nor spend the key) if focus was lost while the keychain answered", async () => {
    let release: (v: boolean) => void = () => {};
    jest.spyOn(require("@/storage/contest-winner-seen"), "hasSeenContestWinner").mockImplementationOnce(() => new Promise<boolean>((r) => (release = r)));
    function Focus({ active }: { active: boolean }) {
      useWinnerReveal("t1", closed(), active);
      return null;
    }
    const view = await render(<Focus active />);
    await view.rerender(<Focus active={false} />);
    await act(async () => release(false));
    expect(mockPush).not.toHaveBeenCalled();
    expect(await hasSeenContestWinner("t1")).toBe(false);
    // Refocus: it opens then.
    await view.rerender(<Focus active />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/contest-winner?trip=t1"));
  });

  it("doesn't open when it was already seen", async () => {
    await markContestWinnerSeen("t1");
    await render(<Opener contest={closed()} />);
    await act(async () => {});
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// While it plays, the line is hidden from VoiceOver under the "Saltar el revelado" surface: skip to read it.
async function skipToEnd() {
  await fireEvent.press(await screen.findByTestId("winner-skip"));
}

describe("WinnerRevealScreen", () => {
  it("develops the winning photo and names its author with the votes", async () => {
    jest.mocked(fetchContest).mockResolvedValue(closed());
    await wrap(<WinnerRevealScreen tripId="t1" />);
    // Mounted with the downloaded thumb, undeveloped.
    expect((await screen.findByTestId("develop-image", { includeHiddenElements: true })).props.accessibilityLabel).toBe("thumb, progress 0");
    expect(screen.queryByText("Ganó la foto de @cami")).toBeNull();
    await skipToEnd();
    expect(screen.getByText("Ganó la foto de @cami")).toBeTruthy();
    expect(screen.getByText("12 votos")).toBeTruthy();
    expect(screen.getByTestId("avatar", { includeHiddenElements: true })).toBeTruthy();
  });

  it("waits for the winner's thumb before developing it (never the sharp photo first)", async () => {
    jest.mocked(useThumbBytes).mockReturnValue({ bytes: {}, settled: false });
    jest.mocked(fetchContest).mockResolvedValue(closed());
    await wrap(<WinnerRevealScreen tripId="t1" />);
    await waitFor(() => expect(fetchContest).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.getByTestId("winner-loading")).toBeTruthy();
    expect(screen.queryByTestId("develop-image", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("winner-photo", { includeHiddenElements: true })).toBeNull();
  });

  it("tells the author it's their photo", async () => {
    jest.mocked(useMe).mockReturnValue({ me: { id: "u2" } } as never);
    jest.mocked(fetchContest).mockResolvedValue(closed());
    await wrap(<WinnerRevealScreen tripId="t1" />);
    await skipToEnd();
    expect(screen.getByText("¡Ganó tu foto!")).toBeTruthy();
  });

  it("names the winner without a username", async () => {
    jest.mocked(fetchContest).mockResolvedValue(closed({ username: null }));
    await wrap(<WinnerRevealScreen tripId="t1" />);
    await skipToEnd();
    expect(screen.getByText("Ganó la foto de Cami")).toBeTruthy();
  });

  it("with Reduce Motion: no shader and no confetti, one success haptic", async () => {
    jest.mocked(useReduceMotion).mockReturnValue(true);
    jest.mocked(fetchContest).mockResolvedValue(closed());
    await wrap(<WinnerRevealScreen tripId="t1" />);
    expect(await screen.findByText("Ganó la foto de @cami")).toBeTruthy();
    expect(screen.queryByTestId("develop-image", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("confetti", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("winner-photo", { includeHiddenElements: true })).toBeTruthy();
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1));
    // Nothing to skip: the button is there right away.
    expect(screen.getByRole("button", { name: "Ver resultados" })).toBeTruthy();
  });

  it("a hidden winner (blocked or reported by you): no photo, only the line and the avatar", async () => {
    jest.mocked(fetchContest).mockResolvedValue(closed({ imageAvailable: false }));
    await wrap(<WinnerRevealScreen tripId="t1" />);
    // The quiet path: nothing to skip, no darkroom.
    expect(await screen.findByText("Ganó la foto de @cami")).toBeTruthy();
    expect(screen.queryByTestId("winner-skip")).toBeNull();
    expect(screen.getByRole("button", { name: "Ver resultados" })).toBeTruthy();
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("develop-image", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("winner-photo", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("avatar", { includeHiddenElements: true })).toBeTruthy();
  });

  it("a tap skips to the end: confetti, and 'Ver resultados' goes to the contest", async () => {
    jest.mocked(fetchContest).mockResolvedValue(closed());
    await wrap(<WinnerRevealScreen tripId="t1" />);
    await screen.findByTestId("winner-skip");
    expect(screen.queryByRole("button", { name: "Ver resultados" })).toBeNull();

    await skipToEnd();
    expect(screen.getByTestId("confetti", { includeHiddenElements: true })).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole("button", { name: "Ver resultados" }));
    expect(mockDismissTo).toHaveBeenCalledWith("/contest?trip=t1");
  });

  it("goes to the contest when there's no winner to reveal", async () => {
    jest.mocked(fetchContest).mockResolvedValue({ ...closed(), winner: null });
    await wrap(<WinnerRevealScreen tripId="t1" />);
    await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith("/contest?trip=t1"));
  });
});
