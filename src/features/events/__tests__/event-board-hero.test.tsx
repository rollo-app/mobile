import { render, screen } from "@testing-library/react-native";
import { EventBoardHero } from "../event-board-hero";

const detail = (trip: object) => ({ trip: { type: "event", name: "Casamiento", startsAt: 0, timezone: "UTC", ...trip }, memberCount: 3, members: [] }) as never;

describe("EventBoardHero without a cover", () => {
  it("shows only the description when there is one", async () => {
    await render(<EventBoardHero detail={detail({ coverUrl: null, description: "Premio: una cena" })} />);
    expect(screen.getByText("Premio: una cena")).toBeTruthy();
    expect(screen.queryByTestId("event-hero")).toBeNull();
  });

  it("renders nothing without cover and description", async () => {
    await render(<EventBoardHero detail={detail({ coverUrl: null, description: null })} />);
    expect(screen.queryByTestId("event-description")).toBeNull();
    expect(screen.queryByText("Casamiento")).toBeNull();
  });
});
