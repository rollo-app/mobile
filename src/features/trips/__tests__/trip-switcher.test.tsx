import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text, useWindowDimensions } from "react-native";
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

  const maxWidthOf = () => {
    const button = screen.getByRole("button");
    return StyleSheet.flatten(typeof button.props.style === "function" ? button.props.style({ pressed: false }) : button.props.style).maxWidth;
  };

  function Probe({ ratio }: { ratio?: number }) {
    const { width } = useWindowDimensions();
    return (
      <>
        <TripSwitcher name="Sur" maxWidthRatio={ratio} />
        <Text testID="w">{String(width)}</Text>
      </>
    );
  }

  it("limits the width to half the screen by default", async () => {
    await render(<Probe />);
    expect(maxWidthOf()).toBe(Number(screen.getByTestId("w").props.children) * 0.5);
  });

  it("applies a custom width ratio", async () => {
    await render(<Probe ratio={0.32} />);
    expect(maxWidthOf()).toBe(Number(screen.getByTestId("w").props.children) * 0.32);
  });
});
