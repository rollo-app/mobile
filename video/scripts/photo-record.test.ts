import { test } from "node:test";
import assert from "node:assert/strict";
import { displaySize, parseExifDate, toPhotoRecord } from "./photo-record.ts";
import { loadPhotos } from "../src/data/load-photos.ts";

const BACK = "iPhone 15 Pro Max back triple camera 6.765mm f/1.78";

test("builds a record with local time at the photo's own offset", () => {
  const record = toPhotoRecord("IMG_5926", {
    latitude: 47.50056,
    longitude: 19.051,
    DateTimeOriginal: new Date("2026-07-09T10:04:40Z"),
    OffsetTimeOriginal: "+02:00",
    LensModel: BACK,
    Orientation: 6,
    PixelWidth: 1200,
    PixelHeight: 900,
  });
  assert.deepEqual(record, {
    id: "IMG_5926",
    file: "photos/IMG_5926.jpg",
    lat: 47.50056,
    lng: 19.051,
    takenAt: "2026-07-09T12:04:40+02:00",
    camera: "back",
    orientation: 6,
    width: 900,
    height: 1200,
  });
});

test("detects the front camera from the lens model", () => {
  const record = toPhotoRecord("IMG_5930", {
    DateTimeOriginal: new Date("2026-07-09T10:04:50Z"),
    OffsetTimeOriginal: "+02:00",
    LensModel: "iPhone 15 Pro Max front camera 2.69mm f/1.9",
    Orientation: 5,
  });
  assert.equal(record.camera, "front");
  assert.equal(record.orientation, 5);
});

test("leaves lat and lng null when there is no GPS", () => {
  const record = toPhotoRecord("x", {
    DateTimeOriginal: new Date("2026-07-09T10:04:40Z"),
    OffsetTimeOriginal: "+02:00",
    LensModel: BACK,
  });
  assert.equal(record.lat, null);
  assert.equal(record.lng, null);
  assert.equal(record.orientation, 1);
});

test("loadPhotos explains how to prepare the photos when they are missing", () => {
  assert.throws(
    () => loadPhotos("/nonexistent/photos.json"),
    {
      message:
        "Faltan las fotos: corré `npm run photos -- <zip o carpeta>` en video/",
    },
  );
});

test("parseExifDate reads the wall clock at the photo's offset, whatever the machine zone", () => {
  const date = parseExifDate("2026:07:09 12:04:40", "+02:00");
  assert.equal(date?.toISOString(), "2026-07-09T10:04:40.000Z");
  assert.equal(parseExifDate("garbage", "+02:00"), null);
});

test("displaySize swaps the axes for orientations 5-8 only", () => {
  assert.deepEqual(displaySize(5712, 4284, 6), { width: 4284, height: 5712 });
  assert.deepEqual(displaySize(5712, 4284, 5), { width: 4284, height: 5712 });
  assert.deepEqual(displaySize(5712, 4284, 1), { width: 5712, height: 4284 });
});
