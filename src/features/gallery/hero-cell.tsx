import { memo } from "react";
import { Cell, type CellProps } from "./gallery-cell";

/** The chapter's hero photo: the width of the screen, 4:3 (the ~800 px thumbnail is enough at that size). Same behaviour as a grid cell. */
export const HeroCell = memo(function HeroCell({ size, ...props }: CellProps) {
  return <Cell {...props} size={size} height={Math.round((size * 3) / 4)} testIDPrefix="gallery-hero-" />;
});
