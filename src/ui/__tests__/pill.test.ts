import { showPill, subscribePill } from "../pill";

describe("pill store", () => {
  it("emits the text to subscribers", () => {
    const fn = jest.fn();
    const off = subscribePill(fn);
    showPill("Hola");
    expect(fn).toHaveBeenCalledWith("Hola");
    off();
  });

  it("stops emitting after unsubscribe", () => {
    const fn = jest.fn();
    subscribePill(fn)();
    showPill("Hola");
    expect(fn).not.toHaveBeenCalled();
  });
});
