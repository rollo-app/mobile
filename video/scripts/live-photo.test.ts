import { test } from "node:test";
import assert from "node:assert/strict";
import { liveWindow, pickStillAt } from "./live-photo.ts";

test("uses the still-image-time marker when it is a short sample", () => {
  assert.equal(pickStillAt({ markerPts: 1.2, markerDuration: 0.03, transformPts: 1.4, duration: 3 }), 1.2);
});

test("a marker spanning the whole clip carries no time: falls back to the transform sample", () => {
  assert.equal(pickStillAt({ markerPts: 0, markerDuration: 1.84, transformPts: 1.3667, duration: 1.84 }), 1.3667);
});

test("without readable metadata the still is at the midpoint", () => {
  assert.equal(pickStillAt({ duration: 1.84 }), 0.92);
  assert.equal(pickStillAt({ transformPts: 9, duration: 2 }), 1);
});

test("clip longer than the lead-in: starts mid-clip so the still lands on the shutter", () => {
  // still at frame 41, shutter 30 frames into the segment -> first video frame is 11
  assert.deepEqual(liveWindow(41 / 30, 30, 30), { startFrom: 11, hold: 0 });
});

test("clip shorter than the lead-in: holds the first frame before it plays", () => {
  assert.deepEqual(liveWindow(0.5, 30, 24), { startFrom: 0, hold: 9 });
});
