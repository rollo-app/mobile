import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { radius, spacing, useTheme } from "./theme";

export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.title, { color: theme.text }]}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const theme = useTheme();
  return <Text style={[styles.body, { color: muted ? theme.muted : theme.text }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="alert" style={[styles.body, { color: theme.danger }]}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? theme.accent : "transparent",
          borderColor: primary ? theme.accent : theme.border,
          opacity: isDisabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? theme.accentText : theme.text} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? theme.accentText : theme.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
        {...props}
      />
    </View>
  );
}

export function Card({ children, onPress, label }: { children: ReactNode; onPress?: () => void; label?: string }) {
  const theme = useTheme();
  const style = [styles.card, { backgroundColor: theme.surface, borderColor: theme.border }];
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {children}
    </Pressable>
  );
}

export function Loading() {
  const theme = useTheme();
  return <ActivityIndicator style={{ marginTop: spacing.xl }} color={theme.accent} />;
}

const styles = StyleSheet.create({
  screen: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  body: { fontSize: 16, lineHeight: 22 },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
  field: { gap: spacing.xs },
  label: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: 17 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.xs },
});
