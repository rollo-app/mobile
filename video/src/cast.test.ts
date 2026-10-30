import { test } from "node:test";
import assert from "node:assert/strict";
import { PEOPLE, authorOf } from "./cast.ts";
import type { PhotoRecord } from "./data/load-photos.ts";

const photo = (id: string, camera: "back" | "front", takenAt: string): PhotoRecord => ({
  id, file: `photos/${id}.jpg`, lat: 1, lng: 2, takenAt, camera, orientation: 1,
});
const all = [
  photo("a", "back", "2026-07-02T10:00:00+02:00"),
  photo("b", "back", "2026-07-03T10:00:00+02:00"),
  photo("c", "front", "2026-07-03T11:00:00+02:00"),
  photo("d", "back", "2026-07-04T10:00:00+02:00"),
];

test("the cast has the six people with names and colors", () => {
  assert.deepEqual(PEOPLE.map((p) => p.id), ["cami", "lu", "juani", "tomi", "fede", "juan"]);
  assert.equal(PEOPLE.find((p) => p.id === "cami")?.color, "#FF2D55");
  assert.equal(PEOPLE.find((p) => p.id === "juan")?.name, "Juan");
});

test("front camera photos are always Juani", () => {
  assert.equal(authorOf(all[2]!, all).id, "juani");
});

test("the author is deterministic and never Juani for back photos", () => {
  assert.equal(authorOf(all[0]!, all).id, authorOf(all[0]!, all).id);
  for (const p of [all[0]!, all[1]!, all[3]!]) assert.notEqual(authorOf(p, all).id, "juani");
  assert.notEqual(authorOf(all[0]!, all).id, authorOf(all[1]!, all).id);
});
