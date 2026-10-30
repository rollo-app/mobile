import { AbsoluteFill } from "remotion";
import { PhotosProvider } from "./data/photos-context";
import type { PhotoRecord } from "./data/load-photos";

export const Hero = ({ photos }: { photos: PhotoRecord[] }) => (
  <PhotosProvider photos={photos}>
    <AbsoluteFill style={{ backgroundColor: "#000" }} />
  </PhotosProvider>
);
