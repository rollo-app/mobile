import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, ErrorText } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { resultText, type Bar } from "./bulk-save-state";
import { PermissionNotice } from "./permission-notice";

type Props = {
  bar: Bar | null;
  selecting: boolean;
  selectedCount: number;
  canSave: boolean;
  featureError: string | null;
  featureErrorDismissed: boolean;
  onDismissFeatureError: () => void;
  onSaveSelected: () => void;
  onCancel: () => void;
  onRetry: (result: Extract<Bar, { kind: "result" }>) => void;
  onDismiss: () => void;
};

/** Bottom bar: download progress / result / permission notice, the selection "Guardar" button, or the feature error. */
export function SaveBar({
  bar,
  selecting,
  selectedCount,
  canSave,
  featureError,
  featureErrorDismissed,
  onDismissFeatureError,
  onSaveSelected,
  onCancel,
  onRetry,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const barStyle = [styles.bar, { paddingBottom: insets.bottom + spacing.sm }];
  return (
    <>
      {!bar && !selecting && featureError && !featureErrorDismissed && (
        <View style={barStyle}>
          <View style={styles.barRow}>
            <View style={{ flex: 1 }}>
              <ErrorText>{featureError}</ErrorText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={onDismissFeatureError}>
              <Text style={[type.subhead, styles.action]}>Listo</Text>
            </Pressable>
          </View>
        </View>
      )}
      {(bar || selecting) && (
        <View style={barStyle}>
          {bar?.kind === "progress" ? (
            <>
              <View style={styles.barRow}>
                <Text
                  style={[type.subhead, { color: colors.label }]}
                >{`Guardando ${Math.min(bar.done + 1, bar.total)} de ${bar.total}`}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Cancelar descarga" onPress={onCancel}>
                  <Text style={[type.subhead, styles.action]}>Cancelar</Text>
                </Pressable>
              </View>
              <View style={styles.track}>
                <View style={[styles.fillBar, { width: `${(bar.done / bar.total) * 100}%` }]} />
              </View>
            </>
          ) : bar?.kind === "denied" ? (
            <View style={styles.barRow}>
              <PermissionNotice />
            </View>
          ) : bar?.kind === "result" ? (
            <View style={styles.barRow}>
              <Text style={[type.subhead, { color: colors.label, flex: 1 }]}>{resultText(bar)}</Text>
              {bar.failed.length > 0 && (
                <Pressable accessibilityRole="button" accessibilityLabel="Reintentar" onPress={() => onRetry(bar)}>
                  <Text style={[type.subhead, styles.action]}>Reintentar</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={onDismiss}>
                <Text style={[type.subhead, styles.action]}>Listo</Text>
              </Pressable>
            </View>
          ) : (
            <Button
              label={selectedCount > 0 ? `Guardar (${selectedCount})` : "Guardar"}
              disabled={selectedCount === 0 || !canSave}
              onPress={onSaveSelected}
            />
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  action: { color: colors.tint },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.fill,
    overflow: "hidden",
  },
  fillBar: { height: 4, backgroundColor: colors.label },
});
