import { Composition, staticFile } from "remotion";
import { fetchPhotos } from "./data/fetch-photos";
import type { PhotoRecord } from "./data/load-photos";
import { Hero } from "./Hero";
import { CameraScene } from "./scenes/CameraScene";
import { GalleryScene } from "./scenes/GalleryScene";
import { ProfileScene } from "./scenes/ProfileScene";
import { PhotosProvider } from "./data/photos-context";
import { Playground } from "./ui/Playground";

const dev = (Scene: () => React.JSX.Element) => ({ photos }: { photos: PhotoRecord[] }) => (
  <PhotosProvider photos={photos}><Scene /></PhotosProvider>
);
const Camera = dev(CameraScene);
const Gallery = dev(GalleryScene);
const Profile = dev(ProfileScene);

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
  <Composition id="Camera" component={Camera} fps={30} width={540} height={1170} durationInFrames={120}
    defaultProps={{ photos: [] as PhotoRecord[] }} calculateMetadata={loadProps} />
  <Composition id="Gallery" component={Gallery} fps={30} width={540} height={1170} durationInFrames={90}
    defaultProps={{ photos: [] as PhotoRecord[] }} calculateMetadata={loadProps} />
  <Composition id="Profile" component={Profile} fps={30} width={540} height={1170} durationInFrames={90}
    defaultProps={{ photos: [] as PhotoRecord[] }} calculateMetadata={loadProps} />
  </>
);
