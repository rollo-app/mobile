import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { TripSwitcher } from "../trip-switcher";

describe("TripSwitcher", () => {
  it("truncates a very long name to one line inside a bounded container", async () => {
    const name = "Un viaje con un nombre larguísimo ".repeat(10);
    await render(<TripSwitcher name={name} />);

    expect(screen.getByText(name).props.numberOfLines).toBe(1);
    const button = screen.getByRole("button");
    const style = StyleSheet.flatten(typeof button.props.style === "function" ? button.props.style({ pressed: false }) : button.props.style);
    expect(typeof style.maxWidth).toBe("number");
  });
});
