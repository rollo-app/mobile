import type { File } from "expo-file-system";
import type { ExifInput } from "./build-exif";
import { hasCaptureDate, writeMetadata } from "./jpeg";

/** Rewrites the JPEG file in place with the photo's metadata. */
export async function embedMetadata(file: File, input: ExifInput): Promise<void> {
  const jpeg = await file.base64();
  await file.write(writeMetadata(jpeg, input), { encoding: "base64" });
}

/**
 * Adds the metadata only if the JPEG doesn't say when it was taken (photos uploaded before Rollo wrote EXIF).
 * Returns whether it wrote. Never throws: a photo without metadata is still worth saving.
 */
export async function embedMetadataIfMissing(file: File, input: ExifInput): Promise<boolean> {
  try {
    if (hasCaptureDate(await file.base64())) return false;
    await embedMetadata(file, input);
    return true;
  } catch {
    return false;
  }
}
