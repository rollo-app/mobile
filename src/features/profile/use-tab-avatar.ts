import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { useMe } from "@/features/auth/use-me";
import { tintHex } from "@/ui/theme";
import { avatarUri } from "./avatar-style";
import { ensureTabAvatarFiles, TAB_ICON_POINTS, TAB_ICON_SCALE } from "./tab-avatar-files";

export type TabAvatarSource = { uri: string; scale: number; width: number; height: number };
export type TabAvatar = { default: TabAvatarSource; selected: TabAvatarSource };

/**
 * `scale`, `width` and `height` are honored: react-native-screens (ios/conversion/RNSConversions-Tabs.mm)
 * builds an RCTImageSource with `size` and `scale` from the source object, and the icon is loaded with
 * that scale, so an 84 px PNG with scale 3 shows at 28 pt. (Not tested on a device yet.)
 */
const source = (uri: string): TabAvatarSource => ({ uri, scale: TAB_ICON_SCALE, width: TAB_ICON_POINTS, height: TAB_ICON_POINTS });

/** Circular images for the "Perfil" tab icon; null while generating, without a photo, or on any error. */
export function useTabAvatar(): TabAvatar | null {
  const { me } = useMe();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const avatarUrl = me?.avatarUrl ?? null;
  const [result, setResult] = useState<{ key: string; value: TabAvatar } | null>(null);
  const key = avatarUrl ? `${avatarUrl}|${scheme}` : null;

  useEffect(() => {
    const uri = avatarUri(avatarUrl);
    if (!avatarUrl || !uri || !key) return;
    let cancelled = false;
    ensureTabAvatarFiles(uri, avatarUrl, tintHex[scheme])
      .then((files) => {
        if (!cancelled) setResult({ key, value: { default: source(files.default), selected: source(files.selected) } });
      })
      .catch(() => {
        // Without the image the tab keeps its SF Symbol.
      });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl, scheme, key]);

  return key && result?.key === key ? result.value : null;
}
