import { Text, type StyleProp, type TextStyle } from "react-native";
import { colors, type } from "@/ui/theme";
import type { Trip } from "./actions";
import { originalsNotice } from "./originals-notice";

/** A quiet footnote about the full-quality originals (see `originalsNotice`); nothing when there is nothing to say. */
export function OriginalsNotice({ originals, timeZone, style }: { originals: Trip["originals"] | undefined; timeZone: string; style?: StyleProp<TextStyle> }) {
  const text = originalsNotice(originals, timeZone);
  if (!text) return null;
  return <Text style={[type.footnote, { color: colors.secondaryLabel }, style]}>{text}</Text>;
}
