import { render, screen } from "@testing-library/react-native";
import { Row } from "../components";

const chevrons = () => JSON.stringify(screen.toJSON()).match(/chevron\.right/g) ?? [];

describe("Row chevron", () => {
  it("shows a chevron on a pressable row by default", async () => {
    await render(<Row label="Editar perfil" onPress={jest.fn()} />);
    expect(chevrons()).toHaveLength(1);
  });

  it("hides the chevron on an immediate action with chevron={false}", async () => {
    await render(<Row label="Cerrar sesión" chevron={false} onPress={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    expect(chevrons()).toHaveLength(0);
  });

  it("shows no chevron on a row without onPress", async () => {
    await render(<Row label="Código" value="ABC123" />);
    expect(chevrons()).toHaveLength(0);
  });

  it("shows the spinner instead of the chevron while loading", async () => {
    await render(<Row label="Borrar cuenta" loading onPress={jest.fn()} />);
    expect(chevrons()).toHaveLength(0);
  });
});
