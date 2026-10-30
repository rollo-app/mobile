import { Composition } from "remotion";
import { Hero } from "./Hero";

export const Root = () => (
  <Composition
    id="Hero"
    component={Hero}
    fps={30}
    width={540}
    height={1170}
    durationInFrames={660}
  />
);
