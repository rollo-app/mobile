import { fireEvent, render, screen } from "@testing-library/react-native";
import { Outro } from "../outro";
import type { StoryStats } from "../story";

const stats: StoryStats = { photos: 1800, videos: 200, people: 3, days: 1, top: null, trimmed: true };
const withTop: StoryStats = { ...stats, top: { name: "Fede", count: 48 } };

describe("Outro", () => {
  it("offers the whole roll in the gallery when days were trimmed", async () => {
    const onGallery = jest.fn();
    await render(<Outro stats={stats} cast={null} onGallery={onGallery} onReplay={jest.fn()} />);
    await fireEvent.press(screen.getByRole("button", { name: "Ver las 2.000 fotos en la galería" }));
    expect(onGallery).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Ver la galería")).toBeNull();
  });

  it("keeps the plain 'Ver la galería' when nothing was trimmed", async () => {
    await render(<Outro stats={{ ...stats, photos: 5, videos: 0, trimmed: false }} cast={null} onGallery={jest.fn()} onReplay={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Ver la galería" })).toBeTruthy();
    expect(screen.queryByText(/Ver las/)).toBeNull();
  });

  it("shows the cast instead of who took the most photos", async () => {
    await render(<Outro stats={withTop} cast={["Cami", "Lu"]} onGallery={jest.fn()} onReplay={jest.fn()} />);
    expect(screen.getByText("Elenco")).toBeTruthy();
    expect(screen.getByText("Cami · Lu")).toBeTruthy();
    expect(screen.queryByText(/sacó más fotos/)).toBeNull();
  });

  it("shows the top photographer as before when there is no cast", async () => {
    await render(<Outro stats={withTop} cast={null} onGallery={jest.fn()} onReplay={jest.fn()} />);
    expect(screen.getByText("Fede sacó más fotos: 48 fotos")).toBeTruthy();
    expect(screen.queryByText("Elenco")).toBeNull();
  });
});
