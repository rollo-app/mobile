import { selectionTitle } from "../selection-title";

describe("selectionTitle", () => {
  it("asks to pick photos while nothing is selected", () => {
    expect(selectionTitle(0)).toBe("Seleccioná fotos");
  });

  it("uses the singular for one photo", () => {
    expect(selectionTitle(1)).toBe("1 seleccionada");
  });

  it("uses the plural for more than one", () => {
    expect(selectionTitle(12)).toBe("12 seleccionadas");
  });
});
