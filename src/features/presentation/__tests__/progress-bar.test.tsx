import { Animated, StyleSheet } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { ProgressBar } from "../progress-bar";

type Node = { props?: { style?: unknown }; children?: unknown } | string;

function fillWidths(): string[] {
  const out: string[] = [];
  const visit = (node: Node | Node[] | null | undefined) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node === "string") return;
    const style = StyleSheet.flatten(node.props?.style as object) as { height?: number; backgroundColor?: string; width?: string } | undefined;
    if (style?.height === 3 && style.backgroundColor === "#fff") out.push(style.width as string);
    visit(node.children as Node[]);
  };
  visit(screen.toJSON() as Node | Node[] | null);
  return out;
}

describe("ProgressBar", () => {
  it("fills done segments, partially the current one and leaves the rest empty", async () => {
    const progress = new Animated.Value(0.5);
    await render(<ProgressBar count={4} current={1} progress={progress} />);
    expect(fillWidths()).toEqual(["100%", "50%", "0%", "0%"]);
  });

  it("completes the previous segment when the current one advances", async () => {
    const progress = new Animated.Value(0.5);
    const { rerender } = await render(<ProgressBar count={4} current={1} progress={progress} />);
    await act(async () => progress.setValue(0));
    await rerender(<ProgressBar count={4} current={2} progress={progress} />);
    expect(fillWidths()).toEqual(["100%", "100%", "0%", "0%"]);
  });

  it("leaves every segment empty when there is no current one", async () => {
    const progress = new Animated.Value(0.7);
    await render(<ProgressBar count={3} current={-1} progress={progress} />);
    expect(fillWidths()).toEqual(["0%", "0%", "0%"]);
  });
});
