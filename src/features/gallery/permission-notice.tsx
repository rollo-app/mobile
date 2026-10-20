import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";

/** Shown when the user denied access to Photos: only Settings can fix it. */
export function PermissionNotice() {
  return (
    <View style={styles.row}>
      <Text style={[type.footnote, styles.text]}>Rollo no tiene permiso para guardar en Fotos.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir Ajustes" onPress={() => void Linking.openSettings()}>
        <Text style={[type.footnote, styles.link]}>Abrir Ajustes</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  text: { color: colors.secondaryLabel, flex: 1 },
  link: { color: colors.tint, fontWeight: "600" },
});
