import { Text } from "react-native";
import { colors, type } from "@/ui/theme";
import { selectionTitle } from "./selection-title";

/** The header title that replaces the trip's name while photos are being selected. */
export function SelectionHeaderTitle({ count }: { count: number }) {
  return (
    <Text accessibilityRole="header" numberOfLines={1} style={[type.headline, { color: colors.label }]}>
      {selectionTitle(count)}
    </Text>
  );
}
