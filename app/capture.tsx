import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Body, Button } from "@/ui/components";
import { spacing } from "@/ui/theme";

/** Captura: llega en el próximo PR (cámara nativa, preview y cola offline). */
export default function CaptureScreen() {
  return (
    <View style={styles.screen}>
      <Body muted>La cámara llega en la próxima versión.</Body>
      <Button label="Cerrar" variant="secondary" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg },
});
