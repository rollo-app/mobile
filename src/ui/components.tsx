import { Children, Fragment, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { colors, radius, spacing, type } from "./theme";

/** Scrolling screen. `grouped` uses the gray background of iOS grouped lists. */
export function Screen({ children, grouped }: { children: ReactNode; grouped?: boolean }) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: grouped ? colors.groupedBackground : colors.background }}
      contentContainerStyle={styles.screen}
    >
      {children}
    </ScrollView>
  );
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[type.body, { color: muted ? colors.secondaryLabel : colors.label }]}>{children}</Text>;
}

export function Footnote({ children }: { children: ReactNode }) {
  return <Text style={[type.footnote, styles.footnote]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" selectable style={[type.subhead, { color: colors.danger }]}>
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
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const primary = variant === "primary";
  const textColor = primary ? colors.onTint : colors.label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? colors.tint : colors.fill, opacity: isDisabled ? 0.35 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[type.headline, { color: textColor }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={[type.footnote, styles.footnote]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.tertiaryLabel}
        style={[type.body, styles.input]}
        {...props}
      />
    </View>
  );
}

/** Inset grouped list section (iOS): rows separated by hairlines, no borders. */
export function Section({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.section}>
      {title && <Text style={[type.headline, styles.sectionTitle]}>{title}</Text>}
      <View style={styles.group}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={styles.separator} />}
            {row}
          </Fragment>
        ))}
      </View>
      {footer && <Footnote>{footer}</Footnote>}
    </View>
  );
}

export function Row({ label, value, note, onPress }: { label: string; value?: string; note?: string; onPress?: () => void }) {
  const content = (
    <>
      <Text style={[type.body, styles.rowLabel]}>{label}</Text>
      {value !== undefined && (
        <View style={styles.rowValueBox}>
          <Text selectable style={[type.body, styles.rowValue]}>
            {value}
          </Text>
          {note !== undefined && <Text style={[type.footnote, styles.rowNote]}>{note}</Text>}
        </View>
      )}
      {onPress && <SymbolView name="chevron.right" size={14} weight="semibold" tintColor={colors.tertiaryLabel as string} />}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}
    >
      {content}
    </Pressable>
  );
}

export function Loading() {
  return <ActivityIndicator style={{ marginTop: spacing.xl }} />;
}

const styles = StyleSheet.create({
  screen: { padding: spacing.md, gap: spacing.lg, flexGrow: 1 },
  footnote: { color: colors.secondaryLabel, paddingHorizontal: spacing.md },
  button: {
    minHeight: 50,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  field: { gap: spacing.sm },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    color: colors.label,
    backgroundColor: colors.cell,
  },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.label, paddingHorizontal: spacing.xs },
  group: { backgroundColor: colors.cell, borderRadius: radius.lg, borderCurve: "continuous", overflow: "hidden" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 50, paddingHorizontal: spacing.md },
  rowLabel: { flex: 1, color: colors.label },
  rowValueBox: { alignItems: "flex-end", paddingVertical: spacing.xs },
  rowNote: { color: colors.tertiaryLabel },
  rowValue: { color: colors.secondaryLabel, fontVariant: ["tabular-nums"] },
});
