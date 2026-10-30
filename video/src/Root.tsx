import { Composition, staticFile } from "remotion";
import { fetchPhotos } from "./data/fetch-photos";
import type { PhotoRecord } from "./data/load-photos";
import { Hero } from "./Hero";
import { Playground } from "./ui/Playground";

const loadProps = async () => ({
  props: { photos: await fetchPhotos(staticFile("photos/index.json")) },
});

export const Root = () => (
  <>
  <Composition
    id="Hero"
    component={Hero}
    fps={30}
    width={540}
    height={1170}
    durationInFrames={660}
    defaultProps={{ photos: [] as PhotoRecord[] }}
    calculateMetadata={loadProps}
  />
  <Composition
    id="Playground"
    component={Playground}
    fps={30}
    width={540}
    height={1170}
    durationInFrames={30}
    defaultProps={{ photos: [] as PhotoRecord[] }}
    calculateMetadata={loadProps}
  />
  </>
);
