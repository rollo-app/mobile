import { render, screen } from "@testing-library/react-native";
import { PinCard } from "../pin-card";
import type { MapItem } from "../features";

const TZ = "America/Argentina/Buenos_Aires";
const NOW = Date.parse("2027-01-14T18:00:00Z");

const item = (over: Partial<MapItem> = {}): MapItem => ({
  id: "m1",
  type: "photo",
  takenAt: Date.parse("2027-01-14T16:10:00Z"),
  day: "2027-01-14",
  lat: -49.33,
  lng: -72.89,
  caption: null,
  durationS: null,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  authorId: "a1",
  authorName: "Cami",
  pending: false,
  ...over,
});

describe("PinCard", () => {
  it("muestra autor, hora relativa y la foto borrosa", async () => {
    await render(<PinCard item={item()} timeZone={TZ} now={NOW} />);

    expect(screen.getByText("Cami")).toBeVisible();
    expect(screen.getByText("hoy 13:10")).toBeVisible();
    expect(screen.getByTestId("pin-thumb")).toBeTruthy();
  });

  it("muestra el caption si hay", async () => {
    await render(<PinCard item={item({ caption: "el viento no perdona" })} timeZone={TZ} now={NOW} />);
    expect(screen.getByText("el viento no perdona")).toBeVisible();
  });

  it("sin thumbhash, un relleno gris", async () => {
    await render(<PinCard item={item({ thumbhash: null })} timeZone={TZ} now={NOW} />);
    expect(screen.getByTestId("pin-thumb-empty")).toBeTruthy();
    expect(screen.queryByTestId("pin-thumb")).toBeNull();
  });

  it("un video dice su duración", async () => {
    await render(<PinCard item={item({ type: "video", durationS: 12.2 })} timeZone={TZ} now={NOW} />);
    expect(screen.getByText("hoy 13:10 · Video · 12 s")).toBeVisible();
  });

  it("una pendiente avisa que espera señal", async () => {
    await render(<PinCard item={item({ pending: true })} timeZone={TZ} now={NOW} />);
    expect(screen.getByText("Esperando señal")).toBeVisible();
  });
});
