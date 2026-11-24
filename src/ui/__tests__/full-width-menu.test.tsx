import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { FullWidthMenuView } from "../full-width-menu";

describe("FullWidthMenuView", () => {
  it("gives its content the full width measured outside the native menu host", async () => {
    await render(
      <FullWidthMenuView actions={[{ id: "a", title: "Acción" }]} onPressAction={() => {}}>
        <Text>Fila</Text>
      </FullWidthMenuView>,
    );
    await fireEvent(screen.getByTestId("full-width-menu"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 361, height: 52 } } });
    expect(StyleSheet.flatten(screen.getByTestId("full-width-menu-content").props.style).width).toBe(361);
    expect(screen.getByText("Fila")).toBeTruthy();
  });
});
