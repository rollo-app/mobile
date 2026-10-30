import { test } from "node:test";
import assert from "node:assert/strict";
import { FPS, SCENES, SEAM_FRAMES, TRANSITION_FRAMES, sceneStart, totalFrames } from "./timeline.ts";

test("the scenes add up to the 22 s composition", () => {
  assert.equal(totalFrames(), 660);
  assert.equal(FPS, 30);
});

test("scenes overlap by the transition length", () => {
  assert.equal(sceneStart("camera"), 0);
  assert.equal(sceneStart("map"), 108);
  assert.equal(sceneStart("reveal"), 108 + 135 - TRANSITION_FRAMES);
});

test("the last scene ends exactly on the last frame", () => {
  const last = SCENES[SCENES.length - 1]!;
  assert.equal(sceneStart(last.id) + last.frames, totalFrames());
});

test("the loop seam fits inside the first and last scenes", () => {
  assert.ok(SEAM_FRAMES <= SCENES[0]!.frames);
  assert.ok(SEAM_FRAMES <= SCENES[SCENES.length - 1]!.frames);
});
