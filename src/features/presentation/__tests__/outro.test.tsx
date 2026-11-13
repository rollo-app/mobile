import { fireEvent, render, screen } from "@testing-library/react-native";
import { Outro } from "../outro";
import type { StoryStats } from "../story";

const stats: StoryStats = { photos: 1800, videos: 200, people: 3, days: 1, top: null, trimmed: true };

describe("Outro", () => {
  it("offers the whole roll in the gallery when days were trimmed", async () => {
    const onGallery = jest.fn();
    await render(<Outro stats={stats} onGallery={onGallery} onReplay={jest.fn()} />);
    await fireEvent.press(screen.getByRole("button", { name: "Ver las 2.000 fotos en la galería" }));
    expect(onGallery).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Ver la galería")).toBeNull();
  });

  it("keeps the plain 'Ver la galería' when nothing was trimmed", async () => {
    await render(<Outro stats={{ ...stats, photos: 5, videos: 0, trimmed: false }} onGallery={jest.fn()} onReplay={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Ver la galería" })).toBeTruthy();
    expect(screen.queryByText(/Ver las/)).toBeNull();
  });
});
