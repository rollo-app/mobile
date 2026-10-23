import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { requestPushPermission } from "./push-permission";
import { syncPushToken } from "./push-token";

/**
 * Our own explanation before the system's notification dialog, shown once after creating or joining
 * a roll. "Activar" shows the system dialog (and registers the token if allowed); "Ahora no" asks nothing.
 */
export function PushPrimer({ onDone }: { onDone: () => void }) {
  const [asking, setAsking] = useState(false);

  async function activate() {
    setAsking(true);
    if (await requestPushPermission()) await syncPushToken();
    onDone();
  }

  return (
    <View style={styles.container}>
      <SymbolView name="bell.badge" size={44} tintColor={colors.secondaryLabel} style={styles.icon} />
      <Text style={[type.title, styles.title]}>¿Te avisamos cuando arranque y cuando se revele?</Text>
      <Text style={[type.body, styles.body]}>
        También cuando te sumen a un rollo o a alguien le guste una foto tuya. Lo podés cambiar cuando quieras en Ajustes.
      </Text>
      <View style={styles.actions}>
        <Button label="Activar" onPress={() => void activate()} loading={asking} />
        <Button label="Ahora no" variant="secondary" onPress={onDone} disabled={asking} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md, backgroundColor: colors.groupedBackground },
  icon: { alignSelf: "center", width: 44, height: 44 },
  title: { color: colors.label, textAlign: "center" },
  body: { color: colors.secondaryLabel, textAlign: "center" },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
