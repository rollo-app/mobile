import type { RevealedPhoto } from "@/features/media/revealed";
import { buildStory } from "../story";
import { initialPlayer, playerReducer } from "../player";

const TZ = "America/Argentina/Buenos_Aires";
const photo = (id: string, iso: string): RevealedPhoto => ({
  id,
  type: "photo",
  takenAt: Date.parse(iso),
  day: iso.slice(0, 10),
  lat: null,
  lng: null,
  caption: null,
  durationS: null,
  width: null,
  height: null,
  thumbhash: null,
  author: { id: "m1", name: "Cami", username: null, avatarUrl: null },
  thumbPath: "/t",
  originalPath: "/o",
});

// 0 intro, 1 day, 2 a, 3 b, 4 day, 5 c, 6 outro
const steps = buildStory(
  [photo("a", "2027-01-12T15:00:00Z"), photo("b", "2027-01-12T16:00:00Z"), photo("c", "2027-01-13T15:00:00Z")],
  TZ,
);
const at = (index: number, paused = false) => ({ steps, index, paused });

describe("playerReducer", () => {
  it("starts at the intro, playing", () => {
    expect(initialPlayer(steps)).toEqual({ steps, index: 0, paused: false });
  });

  it("next moves one step ahead and stops at the outro", () => {
    expect(playerReducer(at(2), { type: "next" }).index).toBe(3);
    expect(playerReducer(at(6), { type: "next" }).index).toBe(6);
  });

  it("prev goes to the previous photo, skipping day cards", () => {
    expect(playerReducer(at(5), { type: "prev" }).index).toBe(3);
    expect(playerReducer(at(3), { type: "prev" }).index).toBe(2);
  });

  it("prev from outro goes to the last photo", () => {
    expect(playerReducer(at(6), { type: "prev" }).index).toBe(5);
  });

  it("prev from the first photo restarts the intro", () => {
    expect(playerReducer(at(2), { type: "prev" }).index).toBe(0);
  });

  it("pause and resume only toggle the pause flag", () => {
    expect(playerReducer(at(3), { type: "pause" })).toEqual(at(3, true));
    expect(playerReducer(at(3, true), { type: "resume" })).toEqual(at(3, false));
  });

  it("moving resumes playback", () => {
    expect(playerReducer(at(3, true), { type: "next" }).paused).toBe(false);
  });

  it("restart goes back to the beginning", () => {
    expect(playerReducer(at(6), { type: "restart" })).toEqual(at(0));
  });

  it("a story with new steps resets to the start", () => {
    const fresh = buildStory([photo("z", "2027-02-01T10:00:00Z")], TZ);
    expect(playerReducer(at(4), { type: "load", steps: fresh })).toEqual({ steps: fresh, index: 0, paused: false });
  });
});
