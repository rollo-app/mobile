import type { CSSProperties } from "react";
import { Img, staticFile } from "remotion";
import { usePhoto } from "../data/photos-context.tsx";

type PhotoProps = { id: string; blur?: number; mirror?: boolean; style?: CSSProperties };

// EXIF orientation is applied by Chromium (image-orientation: from-image); no manual rotation.
export const Photo = ({ id, blur = 0, mirror = false, style }: PhotoProps) => {
  const record = usePhoto(id);
  return (
    <Img
      src={staticFile(record.file)}
      style={{
        width: "100%", height: "100%", objectFit: "cover", display: "block",
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        transform: mirror ? "scaleX(-1)" : undefined,
        ...style,
      }}
    />
  );
};
