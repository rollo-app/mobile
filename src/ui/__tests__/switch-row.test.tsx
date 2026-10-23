import { fireEvent, render, screen } from "@testing-library/react-native";
import { SwitchRow } from "../components";

describe("SwitchRow", () => {
  it("calls onValueChange(true) when toggled on", async () => {
    const onValueChange = jest.fn();
    await render(<SwitchRow label="Perfil público" value={false} onValueChange={onValueChange} />);

    const toggle = screen.getByRole("switch", { name: "Perfil público" });
    expect(toggle.props.value).toBe(false);
    await fireEvent(toggle, "valueChange", true);

    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it("shows the label as text and passes disabled through", async () => {
    await render(<SwitchRow label="Perfil público" value disabled onValueChange={jest.fn()} />);

    expect(screen.getByText("Perfil público")).toBeVisible();
    expect(screen.getByRole("switch", { name: "Perfil público" })).toBeDisabled();
  });
});
