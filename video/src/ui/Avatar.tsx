import type { Person } from "../cast.ts";
import { colors, fonts } from "./theme.ts";
import { Photo, type PhotoProps } from "./Photo.tsx";

export const Avatar = ({ person, size, photoId, framing }: { person: Person; size: number; photoId?: string; framing?: Pick<PhotoProps, "objectPosition" | "zoom" | "transformOrigin"> }) => (
  <div
    style={{
      width: size, height: size, borderRadius: size / 2, overflow: "hidden", flexShrink: 0,
      backgroundColor: person.color, color: colors.onTint, display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: fonts.sans,
      fontWeight: 600, fontSize: size * 0.44,
    }}
  >
    {photoId ? <Photo id={photoId} {...framing} /> : person.initial}
  </div>
);
