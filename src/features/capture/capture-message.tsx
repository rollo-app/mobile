import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { Body, Button } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

/** Full-screen notice shown instead of the camera (locked, closed, no permission). */
export function CaptureMessage(props: {
  symbol: "lock.fill" | "camera.fill";
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.message}>
      <SymbolView name={props.symbol} size={40} tintColor={colors.secondaryLabel as string} />
      <Text style={[type.title, { color: colors.label, textAlign: "center" }]}>{props.title}</Text>
      <Body muted>{props.body}</Body>
      <View style={styles.actions}>
        {props.action && <Button label={props.action.label} onPress={props.action.onPress} />}
        <Button label="Entendido" variant="secondary" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  message: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl, backgroundColor: colors.background },
  actions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md },
});
