import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useState } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { colors, spacing, tintHex, type } from "@/ui/theme";

const VIEWS = ["Fotos", "Mapa"];

const EMPTY = {
  own: {
    photos: "Cuando se revele un rollo, vas a poder elegir tus mejores fotos para mostrar acá.",
    places: "Acá vas a ver las zonas donde sacaste tus fotos destacadas.",
  },
  friend: {
    photos: "Todavía no destacó fotos.",
    places: "Todavía no hay lugares.",
  },
} as const;

/**
 * What a profile shows off: "Fotos | Mapa". For now only the empty state of each segment
 * (featured photos come later). `own` picks the copy for your profile or a friend's.
 */
export function ProfileShowcase({ own }: { own: boolean }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const [view, setView] = useState<"photos" | "places">("photos");
  const copy = EMPTY[own ? "own" : "friend"];

  return (
    <View testID="profile-showcase" style={styles.showcase}>
      <SegmentedControl
        style={styles.segmented}
        values={VIEWS}
        tintColor={tintHex[scheme]}
        selectedIndex={view === "photos" ? 0 : 1}
        onValueChange={(v) => setView(v === "Mapa" ? "places" : "photos")}
      />
      <Text style={[type.subhead, styles.empty]}>{copy[view]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  showcase: { gap: spacing.lg, paddingHorizontal: spacing.md },
  segmented: { height: 32 },
  empty: { color: colors.secondaryLabel, textAlign: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
});
