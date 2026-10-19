import { fireEvent, render, screen } from "@testing-library/react-native";
import { PinCarousel } from "../pin-carousel";
import type { MapItem } from "../features";

const TZ = "America/Argentina/Buenos_Aires";
const item = (id: string, authorName: string): MapItem => ({
  id, type: "photo", takenAt: Date.parse("2027-01-14T16:10:00Z"), day: "2027-01-14", lat: 0, lng: 0,
  caption: null, durationS: null, thumbhash: null, authorId: id, authorName, pending: false,
});

describe("PinCarousel", () => {
  it("con una sola foto es la tarjeta de siempre, sin lista", async () => {
    await render(<PinCarousel items={[item("a", "Cami")]} index={0} onIndexChange={jest.fn()} timeZone={TZ} />);
    expect(screen.getByText("Cami")).toBeVisible();
    expect(screen.queryByTestId("pin-carousel")).toBeNull();
  });

  it("con varias muestra una tarjeta por foto", async () => {
    await render(<PinCarousel items={[item("a", "Cami"), item("b", "Fede")]} index={0} onIndexChange={jest.fn()} timeZone={TZ} />);
    expect(screen.getByTestId("pin-carousel")).toBeTruthy();
    expect(screen.getByText("Cami")).toBeTruthy();
    expect(screen.getByText("Fede")).toBeTruthy();
  });

  it("al deslizar avisa qué tarjeta quedó a la vista", async () => {
    const onIndexChange = jest.fn();
    await render(<PinCarousel items={[item("a", "Cami"), item("b", "Fede")]} index={0} onIndexChange={onIndexChange} timeZone={TZ} />);

    const list = screen.getByTestId("pin-carousel");
    const step = list.props.snapToInterval as number;
    await fireEvent(list, "momentumScrollEnd", { nativeEvent: { contentOffset: { x: step } } });

    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("arranca en la tarjeta de `index` (la foto que se abrió desde el Feed)", async () => {
    await render(<PinCarousel items={[item("a", "Cami"), item("b", "Fede"), item("c", "Nico")]} index={2} onIndexChange={jest.fn()} timeZone={TZ} />);

    expect(screen.getByTestId("pin-carousel").props.initialScrollIndex).toBe(2);
  });
});
