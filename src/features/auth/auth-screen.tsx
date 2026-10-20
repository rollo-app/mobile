import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, type } from "@/ui/theme";

/**
 * Layout of the entry steps: title and copy with the form right below them. A tap outside an input or a
 * drag dismisses the keyboard, and the scroll view makes room for it on its own.
 */
export function AuthScreen({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xl * 2, paddingBottom: insets.bottom + spacing.lg }]}
    >
      <View style={styles.copy}>
        <Text style={[type.largeTitle, { color: colors.label }]}>{title}</Text>
        <Text style={[type.body, { color: colors.secondaryLabel }]}>{subtitle}</Text>
      </View>
      <View style={styles.form}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, gap: spacing.xl, padding: spacing.lg },
  copy: { gap: spacing.sm },
  form: { gap: spacing.md },
});
