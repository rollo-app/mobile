import { rollHref } from "../roll-href";

describe("rollHref", () => {
  it("points at the roll's screen by id", () => {
    expect(rollHref("t1")).toEqual({ pathname: "/roll/[tripId]", params: { tripId: "t1" } });
  });

  it("carries the view when there is one", () => {
    expect(rollHref("t1", "roll")).toEqual({ pathname: "/roll/[tripId]", params: { tripId: "t1", view: "roll" } });
    expect(rollHref("t1", "gallery").params.view).toBe("gallery");
  });
});
