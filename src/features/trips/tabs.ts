import type { NativeTabs } from "expo-router/native-tabs";
import type { ComponentProps } from "react";
import type { RollPhase } from "./phase";

type IconProps = ComponentProps<typeof NativeTabs.Trigger.Icon>;
type Sf = NonNullable<Extract<IconProps, { sf?: unknown }>["sf"]>;
type Md = Extract<Extract<IconProps, { md: unknown }>["md"], string>;

export type TabsConfig = {
  roll: { sf: Sf; md: Md; label: string };
  camera: { sf: Sf; md: Md; label: string; target: "/capture" | "/presentation" | "/roll"; badge: string | null };
};

/**
 * What the tab bar looks like for each phase. NativeTabs can't add or remove tabs on the fly, so
 * the tabs stay and the roll and camera ones change icon, label and behavior after the reveal.
 */
export function tabsFor(phase: RollPhase | null, left: { photos: number } | null, hasTrip = true): TabsConfig {
  if (!hasTrip) {
    return {
      roll: { sf: { default: "film", selected: "film.fill" }, md: "movie", label: "Rollo" },
      camera: { sf: "lock.fill", md: "lock", label: "Cámara, primero hace falta un rollo", target: "/roll", badge: null },
    };
  }
  if (phase === "revealed") {
    return {
      roll: { sf: { default: "square.grid.2x2", selected: "square.grid.2x2.fill" }, md: "grid_view", label: "Galería" },
      camera: { sf: "play.rectangle.fill", md: "slideshow", label: "Presentación", target: "/presentation", badge: null },
    };
  }
  // Outside the shooting phase the camera is closed, whatever the quota says.
  const closed = phase !== null && phase !== "active";
  const locked = closed || (left !== null && left.photos === 0);
  return {
    roll: { sf: { default: "film", selected: "film.fill" }, md: "movie", label: "Rollo" },
    camera: {
      sf: locked ? "lock.fill" : "camera.fill",
      md: locked ? "lock" : "photo_camera",
      label: closed ? "Cámara, rollo cerrado" : locked ? "Cámara, sin fotos" : "Cámara",
      target: "/capture",
      badge: !closed && left !== null && left.photos > 0 ? String(left.photos) : null,
    },
  };
}
