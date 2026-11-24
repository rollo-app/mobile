import { StyleSheet } from "react-native";
import { act, fireEvent, render as rtlRender, screen } from "@testing-library/react-native";
import { useState } from "react";
import type { Schemas } from "@/api/client";
import { FinalistPager, type PagerItem } from "../finalist-pager";
import { PagerProgress } from "../pager-progress";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const finalist = (mediaId: string, userId: string, name: string, username: string | null = null, votes: number | null = null): Schemas["ContestFinalist"] => ({
  mediaId,
  author: { userId, name, username, avatarUrl: null },
  thumbHash: null,
  width: null,
  height: null,
  thumbPath: `/c/${mediaId}/thumb`,
  displayPath: `/c/${mediaId}/display`,
  votes,
});

const ITEMS: PagerItem[] = [
  { finalist: finalist("m1", "u1", "Ana") },
  { finalist: finalist("m2", "u2", "Beto", "beto") },
  { finalist: finalist("m3", "u3", "Cami", "cami") },
];

function Harness(props: Partial<React.ComponentProps<typeof FinalistPager>>) {
  const [vote, setVote] = useState<string | null>(null);
  return (
    <FinalistPager
      items={ITEMS}
      {...props}
      token="tok"
      mode="vote"
      myUserId="u1"
      myVote={props.myVote ?? vote}
      onVote={(id) => {
        props.onVote?.(id);
        setVote(id);
      }}
    />
  );
}

// FlashList flips its "loaded" state from a timer right after mounting; let it land inside act so the output stays clean.
const render = async (ui: React.ReactElement) => {
  const result = await rtlRender(ui);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  return result;
};

const swipeTo = async (page: number) => {
  await fireEvent(screen.getByTestId("finalist-pager"), "momentumScrollEnd", { nativeEvent: { contentOffset: { x: page * 750, y: 0 } } });
};

describe("FinalistPager vote", () => {
  it("shows 'Finalista 1 de 3' and moves on when swiping", async () => {
    const onIndexChange = jest.fn();
    await render(<Harness onIndexChange={onIndexChange} />);
    expect(screen.getByText("Finalista 1 de 3")).toBeTruthy();
    await swipeTo(1);
    expect(screen.getByText("Finalista 2 de 3")).toBeTruthy();
    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("tapping the right side goes to the next photo and the left third to the previous one", async () => {
    const onIndexChange = jest.fn();
    await render(<Harness onIndexChange={onIndexChange} />);
    // The test window is 750 wide: past a third is "next".
    await fireEvent.press(screen.getByTestId("finalist-tap-m1"), { nativeEvent: { locationX: 600 } });
    expect(screen.getByText("Finalista 2 de 3")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("finalist-tap-m2"), { nativeEvent: { locationX: 50 } });
    expect(screen.getByText("Finalista 1 de 3")).toBeTruthy();
    // Nothing before the first one.
    await fireEvent.press(screen.getByTestId("finalist-tap-m1"), { nativeEvent: { locationX: 50 } });
    expect(screen.getByText("Finalista 1 de 3")).toBeTruthy();
    expect(onIndexChange.mock.calls.map((c) => c[0])).toEqual([1, 0]);
  });

  it("tapping the author (avatar or name) opens their profile", async () => {
    const onOpenAuthor = jest.fn();
    await render(<Harness onOpenAuthor={onOpenAuthor} />);
    await fireEvent.press(screen.getByRole("link", { name: "Ver el perfil de Ana" }));
    expect(onOpenAuthor).toHaveBeenCalledWith("u1");
  });

  it("voting calls onVote with the media id and the page shows 'Tu voto'", async () => {
    const onVote = jest.fn();
    await render(<Harness onVote={onVote} initialIndex={1} />);
    // The list starts on page 2 (Beto), so his is the first page mounted.
    await fireEvent.press(screen.getAllByRole("button", { name: "Votar esta" })[0]!);
    expect(onVote).toHaveBeenCalledWith("m2");
    expect(screen.getAllByRole("button", { name: "Tu voto ✓" })).toHaveLength(1);
  });

  it("tapping 'Tu voto' takes the vote back", async () => {
    const onVote = jest.fn();
    await render(<Harness onVote={onVote} myVote="m2" />);
    await fireEvent.press(screen.getByRole("button", { name: "Tu voto ✓" }));
    expect(onVote).toHaveBeenCalledWith(null);
  });

  it("your own photo can't be voted", async () => {
    const onVote = jest.fn();
    await render(<Harness onVote={onVote} />);
    const own = screen.getAllByRole("button", { name: "Votar esta" })[0]!;
    expect(own.props.accessibilityState.disabled).toBe(true);
    expect(own.props.accessibilityHint).toBe("No podés votar tu propia foto");
    await fireEvent.press(own);
    expect(onVote).not.toHaveBeenCalled();
    expect(screen.getByText("No podés votar tu propia foto")).toBeTruthy();
  });

  it("while closing, the button says so and is off", async () => {
    await render(<Harness votingOpen={false} />);
    const buttons = screen.getAllByRole("button", { name: "Cerrando la votación…" });
    expect(buttons.every((b) => b.props.accessibilityState.disabled)).toBe(true);
  });

  it("shows the countdown", async () => {
    await render(<Harness closesAt={Date.now() + 2 * 24 * 3_600_000 + 60_000} />);
    expect(screen.getAllByText("Cierra en 2 días").length).toBeGreaterThan(0);
  });

  it("shows @username and falls back to the name", async () => {
    await render(<Harness />);
    expect(screen.getByText("@cami")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.queryByText("@Ana")).toBeNull();
  });
});

describe("FinalistPager error", () => {
  it("shows the refusal only on the page you're on", async () => {
    await render(<Harness error="La votación no está abierta." />);
    expect(screen.getAllByText("La votación no está abierta.")).toHaveLength(1);
  });
});

describe("FinalistPager results", () => {
  it("shows the place on top and the votes big", async () => {
    const items: PagerItem[] = [
      { finalist: finalist("m2", "u2", "Beto", "beto", 5), place: 1 },
      { finalist: finalist("m1", "u1", "Ana", null, 1), place: 2 },
    ];
    await render(<FinalistPager items={items} token="tok" mode="results" myUserId="u1" />);
    expect(screen.getByText("1° puesto")).toBeTruthy();
    expect(screen.getByText("5 votos")).toBeTruthy();
    expect(screen.getByText("2° puesto")).toBeTruthy();
    expect(screen.getByText("1 voto")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Votar esta" })).toBeNull();
  });

  it("topInset pushes the progress and the place below the status bar", async () => {
    const items: PagerItem[] = [{ finalist: finalist("m2", "u2", "Beto", "beto", 5), place: 1 }];
    await render(<FinalistPager items={items} token="tok" mode="results" myUserId="u1" topInset={47} />);
    const progress = screen.getByTestId("pager-progress");
    expect(StyleSheet.flatten(progress.props.style).top).toBe(47 + 8);
    expect(StyleSheet.flatten(screen.getByText("1° puesto").props.style).top).toBe(47 + 72);
  });
});

describe("PagerProgress", () => {
  it("segments up to 20, a continuous bar past that", async () => {
    const { rerender } = await render(<PagerProgress count={20} index={3} />);
    expect(screen.getAllByTestId("progress-segment")).toHaveLength(20);
    await rerender(<PagerProgress count={21} index={3} />);
    expect(screen.queryAllByTestId("progress-segment")).toHaveLength(0);
    expect(screen.getByTestId("progress-bar-fill")).toBeTruthy();
    expect(screen.getByText("Finalista 4 de 21")).toBeTruthy();
  });
});
