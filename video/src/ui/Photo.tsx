import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { usePhoto } from "../data/photos-context.tsx";

export type PhotoProps = {
  id: string;
  blur?: number;
  mirror?: boolean;
  /** CSS object-position, e.g. "50% 15%". */
  objectPosition?: string;
  /** Extra scale applied on top of the cover fit. */
  zoom?: number;
  transformOrigin?: string;
  style?: CSSProperties;
};

/** Joins transforms in order; the mirror and zoom never replace a caller's own transform. */
export function composeTransform(...parts: (string | false | undefined)[]): string | undefined {
  const joined = parts.filter(Boolean).join(" ");
  return joined === "" ? undefined : joined;
}

// EXIF orientation is applied by Chromium (image-orientation: from-image); no manual rotation.
export const Photo = ({ id, blur = 0, mirror = false, objectPosition, zoom, transformOrigin, style }: PhotoProps) => {
  const record = usePhoto(id);
  return (
    <Img
      src={staticFile(record.file)}
      style={{
        width: "100%", height: "100%", objectFit: "cover", display: "block",
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        objectPosition,
        transformOrigin,
        ...style,
        transform: composeTransform(style?.transform, mirror && "scaleX(-1)", zoom !== undefined && `scale(${zoom})`),
      }}
    />
  );
};
