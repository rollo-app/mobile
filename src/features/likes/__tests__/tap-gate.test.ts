import { createTapGate } from "../tap-gate";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("createTapGate", () => {
  it("runs a single tap only after the double-tap window, with its payload", () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const gate = createTapGate<number>({ onSingle, onDouble, delayMs: 250 });

    gate.tap(10);
    jest.advanceTimersByTime(249);
    expect(onSingle).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onSingle).toHaveBeenCalledWith(10);
    expect(onDouble).not.toHaveBeenCalled();
  });

  it("a second tap inside the window is a double tap and cancels the pending single tap", () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const gate = createTapGate<number>({ onSingle, onDouble, delayMs: 250 });

    gate.tap(10);
    jest.advanceTimersByTime(200);
    gate.tap(20);
    jest.advanceTimersByTime(1000);
    expect(onDouble).toHaveBeenCalledWith(20);
    expect(onSingle).not.toHaveBeenCalled();
  });

  it("two taps further apart than the window are two single taps", () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const gate = createTapGate<number>({ onSingle, onDouble, delayMs: 250 });

    gate.tap(1);
    jest.advanceTimersByTime(300);
    gate.tap(2);
    jest.advanceTimersByTime(300);
    expect(onSingle.mock.calls).toEqual([[1], [2]]);
    expect(onDouble).not.toHaveBeenCalled();
  });

  it("a third tap after a double tap starts over", () => {
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const gate = createTapGate<number>({ onSingle, onDouble, delayMs: 250 });

    gate.tap(1);
    gate.tap(2);
    gate.tap(3);
    jest.advanceTimersByTime(300);
    expect(onDouble).toHaveBeenCalledTimes(1);
    expect(onSingle).toHaveBeenCalledWith(3);
  });

  it("cancel drops a pending single tap", () => {
    const onSingle = jest.fn();
    const gate = createTapGate<number>({ onSingle, onDouble: jest.fn(), delayMs: 250 });

    gate.tap(1);
    gate.cancel();
    jest.advanceTimersByTime(300);
    expect(onSingle).not.toHaveBeenCalled();
  });
});
