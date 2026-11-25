import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { Field } from "../components";
import { colors } from "../theme";

describe("Field", () => {
  // On a white (non-grouped) screen a white input disappeared in light mode: the input uses the system fill instead.
  it("uses the system fill as the input background, so it shows on white screens", async () => {
    await render(<Field label="Email" />);
    expect(StyleSheet.flatten(screen.getByLabelText("Email").props.style).backgroundColor).toBe(colors.fill);
  });

  it("uses the same fill around a prefixed input", async () => {
    await render(<Field label="Usuario" prefix="@" />);
    // The box with the fill is the input's host parent (it holds the "@" and the input).
    const box = screen.getByLabelText("Usuario").parent;
    expect(StyleSheet.flatten(box?.props.style).backgroundColor).toBe(colors.fill);
  });
});
