import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { tripSummary } from "@/test/account";
import { TripRow } from "../trip-row";

const TZ = "America/Argentina/Buenos_Aires";
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-22T12:00:00-03:00");

describe("TripRow", () => {
  const live = tripSummary("t", "Un nombre de rollo muy largo", { startsAt: NOW - DAY, endsAt: NOW + DAY, revealAt: NOW + DAY });

  it("puts the badge in the trailing container, not next to the name", async () => {
    await render(<TripRow trip={live} selected={false} now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(within(screen.getByTestId("trip-row-trailing")).getByText("LIVE")).toBeTruthy();
  });

  it("truncates the name to one line", async () => {
    await render(<TripRow trip={live} selected now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(screen.getByText("Un nombre de rollo muy largo").props.numberOfLines).toBe(1);
  });

  it("shows no badge in the trailing container before the roll starts", async () => {
    const upcoming = tripSummary("t", "Tandil", { startsAt: NOW + 3 * DAY, endsAt: NOW + 5 * DAY, revealAt: NOW + 5 * DAY });
    await render(<TripRow trip={upcoming} selected={false} now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(screen.queryByText("LIVE")).toBeNull();
    expect(screen.queryByText("Revelado")).toBeNull();
  });

  it("with a long-press menu, the row (and its pressed highlight) takes the full measured width", async () => {
    await render(<TripRow trip={live} selected={false} now={NOW} timeZone={TZ} onPress={() => {}} actions={["leave"]} onAction={() => {}} />);
    await fireEvent(screen.getByTestId("trip-row-measure"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 361, height: 64 } } });
    const row = screen.getByRole("button", { name: /Un nombre de rollo muy largo/ });
    expect(StyleSheet.flatten(row.props.style).width).toBe(361);
  });

  it("marks an event with an 'Evento' badge next to its state", async () => {
    const event = tripSummary("e", "Casamiento", { startsAt: NOW - DAY, endsAt: NOW + DAY, revealAt: NOW + DAY, type: "event" });
    await render(<TripRow trip={event} selected={false} now={NOW} timeZone={TZ} onPress={() => {}} />);
    const trailing = within(screen.getByTestId("trip-row-trailing"));
    expect(trailing.getByText("Evento")).toBeTruthy();
    expect(trailing.getByText("LIVE")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Casamiento, evento/ })).toBeTruthy();
  });

  it("a regular rollo has no 'Evento' badge", async () => {
    await render(<TripRow trip={live} selected={false} now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(screen.queryByText("Evento")).toBeNull();
  });
});
