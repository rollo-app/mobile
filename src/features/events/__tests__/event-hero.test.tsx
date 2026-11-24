import { fireEvent, render, screen } from "@testing-library/react-native";
import { EventHero } from "../event-hero";

describe("EventHero description", () => {
  it("shows the description under the name, clamped to 3 lines, with Ver más that expands it", async () => {
    await render(<EventHero name="Casamiento" coverUrl="/c.jpg" description={"Una\nlínea"} />);
    const text = screen.getAllByText("Una\nlínea")[0]!;
    const measure = screen.getByTestId("event-description-measure", { includeHiddenElements: true });
    expect(text.props.numberOfLines).toBe(3);
    expect(measure.props.numberOfLines).toBeUndefined();
    expect(measure.props.pointerEvents).toBe("none");
    expect(screen.queryByRole("button", { name: "Ver más" })).toBeNull();
    await fireEvent(measure, "textLayout", { nativeEvent: { lines: [1, 2, 3, 4].map(() => ({})) } });
    await fireEvent.press(screen.getByRole("button", { name: "Ver más" }));
    expect(screen.getAllByText("Una\nlínea")[0]!.props.numberOfLines).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Ver más" })).toBeNull();
  });

  it("collapses again when the text changes", async () => {
    const view = await render(<EventHero name="Casamiento" coverUrl="/c.jpg" description="Uno" />);
    await fireEvent(screen.getByTestId("event-description-measure", { includeHiddenElements: true }), "textLayout", { nativeEvent: { lines: [1, 2, 3, 4].map(() => ({})) } });
    await fireEvent.press(screen.getByRole("button", { name: "Ver más" }));
    await view.rerender(<EventHero name="Casamiento" coverUrl="/c.jpg" description="Dos" />);
    expect(screen.getAllByText("Dos")[0]!.props.numberOfLines).toBe(3);
    expect(screen.queryByRole("button", { name: "Ver más" })).toBeNull();
  });

  it("leaves no gap without a description", async () => {
    await render(<EventHero name="Casamiento" coverUrl="/c.jpg" description={null} />);
    expect(screen.queryByTestId("event-description")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver más" })).toBeNull();
  });
});
