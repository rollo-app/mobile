import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ContestFinalist } from "../actions";
import { rankFinalists } from "../ranking";
import { ResultsList } from "../results-list";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const f = (mediaId: string, username: string, votes: number | null): ContestFinalist => ({
  mediaId,
  author: { userId: `u-${mediaId}`, name: username.toUpperCase(), username, avatarUrl: null },
  thumbHash: null,
  width: null,
  height: null,
  thumbPath: `/c/${mediaId}/thumb`,
  displayPath: `/c/${mediaId}/display`,
  votes,
});

const closed = [f("a", "ana", 9), f("b", "beto", 1), f("c", "cami", 0)];
const winner = { mediaId: "a", author: { userId: "u-a", name: "ANA", username: "ana", avatarUrl: null }, imageAvailable: true };

describe("ResultsList", () => {
  it("shows the winner on top and each row's votes", async () => {
    await render(<ResultsList ranked={rankFinalists(closed)} winner={winner} token="tok" onOpen={jest.fn()} />);
    expect(screen.getByText("Ganadora")).toBeTruthy();
    expect(screen.getAllByText("9 votos")).toHaveLength(2);
    expect(screen.getByText("1 voto")).toBeTruthy();
    expect(screen.getByText("0 votos")).toBeTruthy();
  });

  it("shows each person's name with the @username under it", async () => {
    await render(<ResultsList ranked={rankFinalists(closed)} winner={winner} token="tok" onOpen={jest.fn()} />);
    expect(screen.getAllByText("ANA").length).toBeGreaterThanOrEqual(2); // the winner on top and her row
    expect(screen.getAllByText("@ana").length).toBeGreaterThanOrEqual(2);
  });

  it("tapping the winner's avatar or name opens her profile", async () => {
    const onOpenAuthor = jest.fn();
    await render(<ResultsList ranked={rankFinalists(closed)} winner={winner} token="tok" onOpen={jest.fn()} onOpenAuthor={onOpenAuthor} />);
    await fireEvent.press(screen.getByRole("link", { name: "Ver el perfil de ANA" }));
    expect(onOpenAuthor).toHaveBeenCalledWith("u-a");
  });

  it("shows the place with its ordinal sign and labels each row for VoiceOver", async () => {
    await render(<ResultsList ranked={rankFinalists(closed)} winner={winner} token="tok" onOpen={jest.fn()} />);
    expect(screen.getByText("1°")).toBeTruthy();
    expect(screen.getByRole("button", { name: "1° puesto, @ana, 9 votos" })).toBeTruthy();
  });

  it("opens the tapped row by its index in rank order", async () => {
    const onOpen = jest.fn();
    await render(<ResultsList ranked={rankFinalists(closed)} winner={winner} token="tok" onOpen={onOpen} />);
    await fireEvent.press(screen.getByRole("button", { name: "2° puesto, @beto, 1 voto" }));
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  const tied = rankFinalists([f("a", "ana", null), f("b", "beto", null), f("c", "cami", null)]);

  it("tie: the organizer picks only among the tied", async () => {
    const onPick = jest.fn();
    await render(<ResultsList ranked={tied} winner={null} token="tok" tiedIds={new Set(["a", "b", "gone"])} canPickWinner onPick={onPick} onOpen={jest.fn()} />);
    const buttons = screen.getAllByRole("button", { name: "Elegir ganadora" });
    expect(buttons).toHaveLength(2);
    await fireEvent.press(buttons[0]!);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ mediaId: "a" }));
  });

  it("tie: a guest sees them marked but no button", async () => {
    await render(<ResultsList ranked={tied} winner={null} token="tok" tiedIds={new Set(["a", "b"])} onOpen={jest.fn()} />);
    expect(screen.getAllByText("Empatada")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "@ana, empatada" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Elegir ganadora" })).toBeNull();
  });
});
