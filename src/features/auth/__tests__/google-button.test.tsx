import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { GOOGLE_BUTTON_THEMES, GoogleSignInButton } from "../google-button";

describe("GoogleSignInButton", () => {
  it("is a button labelled 'Continuar con Google' with Google's logo, and presses", async () => {
    const onPress = jest.fn();
    await render(<GoogleSignInButton onPress={onPress} />);

    const button = screen.getByRole("button", { name: "Continuar con Google" });
    expect(screen.getByTestId("google-logo")).toBeVisible();
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("while loading shows a spinner instead of the logo and doesn't press", async () => {
    const onPress = jest.fn();
    await render(<GoogleSignInButton onPress={onPress} loading />);

    const button = screen.getByRole("button", { name: "Continuar con Google" });
    expect(button.props.accessibilityState).toEqual({ busy: true, disabled: true });
    expect(screen.queryByTestId("google-logo")).toBeNull();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("uses Google's light and dark button colors (never recolored)", async () => {
    expect(GOOGLE_BUTTON_THEMES.light).toEqual({ background: "#FFFFFF", border: "#747775", text: "#1F1F1F" });
    expect(GOOGLE_BUTTON_THEMES.dark).toEqual({ background: "#131314", border: "#8E918F", text: "#E3E3E3" });

    await render(<GoogleSignInButton onPress={jest.fn()} />);
    const style = StyleSheet.flatten(screen.getByRole("button", { name: "Continuar con Google" }).props.style);
    expect(style).toMatchObject({ height: 50, backgroundColor: "#FFFFFF", borderColor: "#747775" });
  });
});
