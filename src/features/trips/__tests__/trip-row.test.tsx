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
    await render(<TripRow trip={live} now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(within(screen.getByTestId("trip-row-trailing")).getByText("LIVE")).toBeTruthy();
  });

  it("truncates the name to one line", async () => {
    await render(<TripRow trip={live}now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(screen.getByText("Un nombre de rollo muy largo").props.numberOfLines).toBe(1);
  });

  it("shows no badge in the trailing container before the roll starts", async () => {
    const upcoming = tripSummary("t", "Tandil", { startsAt: NOW + 3 * DAY, endsAt: NOW + 5 * DAY, revealAt: NOW + 5 * DAY });
    await render(<TripRow trip={upcoming} now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(screen.queryByText("LIVE")).toBeNull();
    expect(screen.queryByText("Revelado")).toBeNull();
  });

  it("with a long-press menu, the row (and its pressed highlight) takes the full measured width", async () => {
    await render(<TripRow trip={live} now={NOW} timeZone={TZ} onPress={() => {}} actions={["leave"]} onAction={() => {}} />);
    await fireEvent(screen.getByTestId("full-width-menu"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 361, height: 64 } } });
    expect(StyleSheet.flatten(screen.getByTestId("full-width-menu-content").props.style).width).toBe(361);
    expect(screen.getByRole("button", { name: /Un nombre de rollo muy largo/ })).toBeTruthy();
  });

  it("marks an event with an 'Evento' badge next to its state", async () => {
    const event = tripSummary("e", "Casamiento", { startsAt: NOW - DAY, endsAt: NOW + DAY, revealAt: NOW + DAY, type: "event" });
    await render(<TripRow trip={event} now={NOW} timeZone={TZ} onPress={() => {}} />);
    const trailing = within(screen.getByTestId("trip-row-trailing"));
    expect(trailing.getByText("Evento")).toBeTruthy();
    expect(trailing.getByText("LIVE")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Casamiento, evento/ })).toBeTruthy();
  });

  it("a regular rollo has no 'Evento' badge", async () => {
    await render(<TripRow trip={live} now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(screen.queryByText("Evento")).toBeNull();
  });

  it("has no checkmark", async () => {
    await render(<TripRow trip={live} now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(screen.getByRole("button", { name: /Un nombre de rollo muy largo/ }).props.accessibilityState?.selected).toBeUndefined();
  });

  it("shows the event cover", async () => {
    const event = tripSummary("e", "Casamiento", { type: "event", coverUrl: "/c.jpg", coverThumbhash: "3OcRJYB4d3h/iIeHeEh3eIhw+j3A" });
    await render(<TripRow trip={event} now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(screen.getByTestId("trip-row-thumb").props.source).toEqual([expect.objectContaining({ uri: expect.stringMatching(/\/c\.jpg$/) })]);
  });

  it("falls back to the thumbhash as placeholder when there is no cover", async () => {
    const trip = tripSummary("t", "Sur", { coverThumbhash: "3OcRJYB4d3h/iIeHeEh3eIhw+j3A" });
    await render(<TripRow trip={trip} now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(screen.getByTestId("trip-row-thumb").props.placeholder).toEqual([expect.objectContaining({ uri: expect.stringContaining("thumbhash:") })]);
  });

  it("crops the thumbnail at the cover's focus", async () => {
    const trip = tripSummary("t", "Boda", { coverUrl: "/c.jpg", coverFocusY: 0.2 });
    await render(<TripRow trip={trip} now={NOW} timeZone={TZ} onPress={() => {}} />);
    expect(screen.getByTestId("trip-row-thumb").props.contentPosition).toEqual({ top: "20%" });
  });
});
