import { Composition, staticFile } from "remotion";
import { fetchPhotos } from "./data/fetch-photos";
import type { PhotoRecord } from "./data/load-photos";
import { Hero } from "./Hero";

export const Root = () => (
  <Composition
    id="Hero"
    component={Hero}
    fps={30}
    width={540}
    height={1170}
    durationInFrames={660}
    defaultProps={{ photos: [] as PhotoRecord[] }}
    calculateMetadata={async () => ({
      props: { photos: await fetchPhotos(staticFile("photos/index.json")) },
    })}
  />
);
