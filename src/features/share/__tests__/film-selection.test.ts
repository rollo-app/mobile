import { act, renderHook } from "@testing-library/react-native";
import { getCollageSelection, setCollageSelection } from "../collage-selection";
import { getFilmSelection, setFilmSelection, useFilmSelection } from "../film-selection";

beforeEach(() => {
  setFilmSelection("t", []);
  setCollageSelection("t", []);
});

describe("film selection", () => {
  it("sets and gets the ids of a trip", () => {
    expect(getFilmSelection("t")).toEqual([]);
    setFilmSelection("t", ["a", "b"]);
    expect(getFilmSelection("t")).toEqual(["a", "b"]);
  });

  it("notifies subscribers", async () => {
    const { result } = await renderHook(() => useFilmSelection("t"));
    expect(result.current).toEqual([]);
    await act(async () => setFilmSelection("t", ["x"]));
    expect(result.current).toEqual(["x"]);
  });

  it("is independent from the collage selection of the same trip", () => {
    setFilmSelection("t", ["f"]);
    setCollageSelection("t", ["c"]);
    expect(getFilmSelection("t")).toEqual(["f"]);
    expect(getCollageSelection("t")).toEqual(["c"]);
  });
});
