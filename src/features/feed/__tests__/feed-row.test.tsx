import { fireEvent, render, screen } from "@testing-library/react-native";
import type { MapItem } from "@/features/map/features";
import { FeedRow } from "../feed-row";

const TZ = "America/Argentina/Buenos_Aires";

const item = (over: Partial<MapItem> = {}): MapItem => ({
  id: "f1",
  type: "photo",
  takenAt: Date.parse("2027-01-12T17:32:00Z"),
  day: "2027-01-12",
  lat: -49.33,
  lng: -72.89,
  caption: null,
  durationS: null,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  authorId: "m2",
  authorName: "Cami",
  pending: false,
  ...over,
});

describe("FeedRow", () => {
  it("muestra la inicial, el nombre con la hora del viaje y 'sacó una foto' si no hay caption", async () => {
    await render(<FeedRow item={item()} timeZone={TZ} />);

    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.getByText("Cami")).toBeTruthy();
    expect(screen.getByText("14:32")).toBeTruthy();
    expect(screen.getByText("sacó una foto")).toBeTruthy();
  });

  it("para un video sin caption dice cuánto dura", async () => {
    await render(<FeedRow item={item({ type: "video", durationS: 12.2 })} timeZone={TZ} />);
    expect(screen.getByText("sacó un video · 12 s")).toBeTruthy();
  });

  it("con caption, el caption es lo principal y no aparece el texto genérico", async () => {
    await render(<FeedRow item={item({ caption: "el viento no perdona" })} timeZone={TZ} />);

    expect(screen.getByText("el viento no perdona")).toBeTruthy();
    expect(screen.queryByText("sacó una foto")).toBeNull();
  });

  it("muestra el thumbhash borroso, o un relleno gris si no hay", async () => {
    const { rerender } = await render(<FeedRow item={item()} timeZone={TZ} />);
    expect(screen.getByTestId("feed-thumb")).toBeTruthy();

    await rerender(<FeedRow item={item({ thumbhash: null })} timeZone={TZ} />);
    expect(screen.getByTestId("feed-thumb-empty")).toBeTruthy();
  });

  it("una foto pendiente dice 'Esperando señal'", async () => {
    await render(<FeedRow item={item({ pending: true })} timeZone={TZ} />);
    expect(screen.getByText("Esperando señal")).toBeTruthy();
  });

  it("tocar una fila con ubicación avisa con el item", async () => {
    const onPress = jest.fn();
    await render(<FeedRow item={item()} timeZone={TZ} onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button", { name: /^Cami, / }));

    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: "f1" }));
  });

  it("sin ubicación la fila no es tocable ni muestra lugar", async () => {
    await render(<FeedRow item={item({ lat: null, lng: null })} timeZone={TZ} onPress={jest.fn()} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("solo con onDelete (admin) ofrece 'Borrar foto', y lo avisa con el item", async () => {
    const onDelete = jest.fn();
    const { rerender } = await render(<FeedRow item={item()} timeZone={TZ} />);
    expect(screen.queryByRole("menuitem", { name: "Borrar foto" })).toBeNull();

    await rerender(<FeedRow item={item()} timeZone={TZ} onDelete={onDelete} />);
    await fireEvent.press(screen.getByRole("menuitem", { name: "Borrar foto" }));

    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "f1" }));
  });

  it("una pendiente no se puede borrar aunque haya onDelete", async () => {
    await render(<FeedRow item={item({ pending: true })} timeZone={TZ} onDelete={jest.fn()} />);
    expect(screen.queryByRole("menuitem", { name: "Borrar foto" })).toBeNull();
  });
});
