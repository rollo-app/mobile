import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMERA_VIEW, GALLERY, MOMENT_MAIN, MOMENT_SECOND, PROFILE_AVATAR, REVEAL, SELFIES, mapPhotos,
} from "./selection.ts";
import type { PhotoRecord } from "./data/load-photos.ts";

const rec = (id: string, lat: number | null, takenAt: string): PhotoRecord => ({
  id, file: `photos/${id}.jpg`, lat, lng: lat === null ? null : 2, takenAt, camera: "back", orientation: 1, width: 900, height: 1200,
});

test("mapPhotos drops photos without GPS and sorts by time", () => {
  const result = mapPhotos([
    rec("late", 1, "2026-07-05T10:00:00+02:00"),
    rec("nogps", null, "2026-07-01T10:00:00+02:00"),
    rec("early", 1, "2026-07-02T10:00:00+02:00"),
    rec("undated", 1, ""),
  ]);
  assert.deepEqual(result.map((p) => p.id), ["early", "late"]);
});

test("GALLERY and REVEAL have unique ids and no selfies", () => {
  for (const list of [GALLERY, REVEAL]) {
    assert.equal(new Set(list).size, list.length);
    for (const id of list) assert.ok(!SELFIES.includes(id), `${id} is a selfie`);
  }
  assert.equal(REVEAL.length, 12);
  assert.ok(REVEAL.every((id) => GALLERY.includes(id)));
});

test("the fixed roles point at the agreed photos", () => {
  assert.equal(PROFILE_AVATAR, "IMG_6386");
  assert.equal(MOMENT_MAIN, "IMG_6073");
  assert.equal(MOMENT_SECOND, "IMG_6092");
  assert.equal(CAMERA_VIEW, "IMG_6198");
  assert.ok(SELFIES.includes(PROFILE_AVATAR) && SELFIES.includes(MOMENT_SECOND));
});
