import { fireEvent, render, screen } from "@testing-library/react-native";
import { EventHero } from "../event-hero";

describe("EventHero description", () => {
  it("shows the description under the name, clamped to 3 lines, with Ver más that expands it", async () => {
    await render(<EventHero name="Casamiento" coverUrl="/c.jpg" description={"Una\nlínea"} />);
    const text = screen.getByText("Una\nlínea");
    expect(text.props.numberOfLines).toBe(3);
    expect(screen.queryByRole("button", { name: "Ver más" })).toBeNull();
    await fireEvent(text, "textLayout", { nativeEvent: { lines: [1, 2, 3, 4].map(() => ({})) } });
    await fireEvent.press(screen.getByRole("button", { name: "Ver más" }));
    expect(screen.getByText("Una\nlínea").props.numberOfLines).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Ver más" })).toBeNull();
  });

  it("leaves no gap without a description", async () => {
    await render(<EventHero name="Casamiento" coverUrl="/c.jpg" description={null} />);
    expect(screen.queryByTestId("event-description")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver más" })).toBeNull();
  });
});
