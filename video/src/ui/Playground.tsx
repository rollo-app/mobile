import { PhotosProvider } from "../data/photos-context.tsx";
import type { PhotoRecord } from "../data/load-photos.ts";
import { PEOPLE } from "../cast.ts";
import { Avatar } from "./Avatar.tsx";
import { Photo } from "./Photo.tsx";
import { Screen } from "./Screen.tsx";
import { Segmented } from "./Segmented.tsx";
import { TabBar } from "./TabBar.tsx";
import { colors, fonts, type } from "./theme.ts";

// Dev-only composition: shows each primitive. Not rendered to the site.
export const Playground = ({ photos }: { photos: PhotoRecord[] }) => {
  const first = photos[0]!.id;
  const second = photos[1]!.id;
  return (
    <PhotosProvider photos={photos}>
      <Screen>
        <div style={{ position: "absolute", top: 120, left: 32, right: 32 }}>
          <div style={{ ...type.title, fontFamily: fonts.sans }}>Rollo</div>
          <div style={{ marginTop: 24 }}>
            <Segmented items={["Mapa", "Feed"]} active={0} />
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 28 }}>
            {PEOPLE.map((p, i) => (
              <Avatar key={p.id} person={p} size={64} photoId={i === 2 ? second : undefined} />
            ))}
          </div>
          <div style={{ ...type.body, marginTop: 28 }}>Cami sacó una foto</div>
          <div style={{ ...type.footnote, color: colors.secondaryLabel }}>14:32</div>
          <div style={{ display: "flex", gap: 16, marginTop: 28, height: 360 }}>
            <div style={{ flex: 1, borderRadius: 20, overflow: "hidden" }}><Photo id={first} /></div>
            <div style={{ flex: 1, borderRadius: 20, overflow: "hidden" }}><Photo id={first} blur={24} /></div>
          </div>
        </div>
        <TabBar active="map" />
      </Screen>
    </PhotosProvider>
  );
};
