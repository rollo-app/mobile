import { render, screen } from "@testing-library/react-native";
import { DayCard } from "../day-card";
import type { StoryStep } from "../story";

const step = (over: Partial<Extract<StoryStep, { kind: "day" }>>) =>
  ({ kind: "day", day: "2027-01-12", number: 1, title: "Día 1", date: "12 de enero", count: 2000, shown: 30, trimmed: true, ...over }) as Extract<StoryStep, { kind: "day" }>;

describe("DayCard", () => {
  it("shows the real count and says it is a selection when the day was trimmed", async () => {
    await render(<DayCard step={step({})} />);
    expect(screen.getByText("2.000 fotos")).toBeTruthy();
    expect(screen.getByText("Una selección de 30")).toBeTruthy();
    expect(screen.getByLabelText("Día 1, 12 de enero, 2.000 fotos, una selección de 30")).toBeTruthy();
  });

  it("stays as it was when nothing was trimmed", async () => {
    await render(<DayCard step={step({ count: 5, shown: 5, trimmed: false })} />);
    expect(screen.queryByText(/fotos/)).toBeNull();
    expect(screen.getByLabelText("Día 1, 12 de enero")).toBeTruthy();
  });
});
