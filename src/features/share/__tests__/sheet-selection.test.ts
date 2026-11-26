import { act, renderHook } from "@testing-library/react-native";
import { getCollageSelection, setCollageSelection } from "../collage-selection";
import { getFilmSelection, setFilmSelection } from "../film-selection";
import { getSheetChoices, setSheetChoices, useSheetChoices } from "../sheet-selection";

beforeEach(() => {
  setSheetChoices("t", {});
  setSheetChoices("u", {});
  setFilmSelection("t", []);
  setCollageSelection("t", []);
});

describe("sheet selection", () => {
  it("sets and gets the choices of a trip", () => {
    expect(getSheetChoices("t")).toEqual({});
    setSheetChoices("t", { a: "out", b: "highlight" });
    expect(getSheetChoices("t")).toEqual({ a: "out", b: "highlight" });
  });

  it("notifies subscribers", async () => {
    const { result } = await renderHook(() => useSheetChoices("t"));
    expect(result.current).toEqual({});
    await act(async () => setSheetChoices("t", { x: "out" }));
    expect(result.current).toEqual({ x: "out" });
  });

  it("is independent per trip", () => {
    setSheetChoices("t", { a: "out" });
    expect(getSheetChoices("u")).toEqual({});
  });

  it("is independent from the collage's and the route film's selections", () => {
    setSheetChoices("t", { s: "highlight" });
    setFilmSelection("t", ["f"]);
    setCollageSelection("t", ["c"]);
    expect(getSheetChoices("t")).toEqual({ s: "highlight" });
    expect(getFilmSelection("t")).toEqual(["f"]);
    expect(getCollageSelection("t")).toEqual(["c"]);
  });
});
