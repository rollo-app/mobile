import { Text } from "react-native";
import { colors, type } from "@/ui/theme";

/** The roll's name as a large title at the top of a revealed roll's views (the bar holds the Galería | Rollo control instead). */
export function RollTitle({ name }: { name: string }) {
  return (
    <Text accessibilityRole="header" numberOfLines={2} ellipsizeMode="tail" style={[type.largeTitle, { color: colors.label }]}>
      {name}
    </Text>
  );
}
