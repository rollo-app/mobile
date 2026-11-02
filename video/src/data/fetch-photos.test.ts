import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchPhotos } from "./fetch-photos.ts";
import { MISSING_PHOTOS } from "./messages.ts";

test("returns the photos when the index is served", async () => {
  const photos = [{ id: "a" }];
  const result = await fetchPhotos("photos/index.json", async () => ({ ok: true, json: async () => photos }));
  assert.deepEqual(result, photos);
});

test("a 404 throws the prepare-photos message", async () => {
  await assert.rejects(
    fetchPhotos("photos/index.json", async () => ({ ok: false, json: async () => ({}) })),
    { message: MISSING_PHOTOS },
  );
  assert.equal(MISSING_PHOTOS, "Faltan las fotos: corré `npm run photos -- <zip o carpeta>` en video/");
});
