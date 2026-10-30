import type { Person } from "../cast.ts";
import { colors, fonts } from "./theme.ts";
import { Photo } from "./Photo.tsx";

export const Avatar = ({ person, size, photoId }: { person: Person; size: number; photoId?: string }) => (
  <div
    style={{
      width: size, height: size, borderRadius: size / 2, overflow: "hidden", flexShrink: 0,
      backgroundColor: person.color, color: colors.onTint, display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: fonts.sans,
      fontWeight: 600, fontSize: size * 0.44,
    }}
  >
    {photoId ? <Photo id={photoId} /> : person.initial}
  </div>
);
