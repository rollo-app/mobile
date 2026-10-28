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
import { Host, Toggle } from "@expo/ui/swift-ui";
import { accessibilityLabel, disabled as disabledModifier, labelsHidden, tint } from "@expo/ui/swift-ui/modifiers";
import { SymbolView } from "expo-symbols";
import { colors, radius, spacing, type } from "./theme";

/** Scrolling screen. `grouped` uses the gray background of iOS grouped lists. */
export function Screen({ children, grouped, testID }: { children: ReactNode; grouped?: boolean; testID?: string }) {
  return (
    <ScrollView
      testID={testID}
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

export function Field({ label, prefix, style, ...props }: { label: string; /** Fixed text before the input, like the "@" of a handle. */ prefix?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={[type.footnote, styles.footnote]}>{label}</Text>
      {prefix ? (
        <View style={[styles.input, styles.prefixed]}>
          <Text style={[type.body, { color: colors.secondaryLabel }]}>{prefix}</Text>
          <TextInput
            accessibilityLabel={label}
            placeholderTextColor={colors.tertiaryLabel}
            style={[type.body, styles.prefixedInput, style]}
            {...props}
          />
        </View>
      ) : (
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.tertiaryLabel}
          style={[type.body, styles.input, style]}
          {...props}
        />
      )}
    </View>
  );
}

/** Inset grouped list section (iOS): rows separated by hairlines, no borders. */
export function Section({
  title,
  titleAccessory,
  footer,
  children,
}: {
  title?: string;
  /** Next to the title (an "i" button). */
  titleAccessory?: ReactNode;
  footer?: string;
  children: ReactNode;
}) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.section}>
      {title && (
        <View style={styles.sectionTitleRow}>
          <Text style={[type.headline, styles.sectionTitle]}>{title}</Text>
          {titleAccessory}
        </View>
      )}
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

export function Row({
  label,
  value,
  note,
  onPress,
  loading,
  tone,
  leading,
  detail,
  accessory,
  chevron = true,
  accessibilityActions,
  onAccessibilityAction,
}: {
  /** VoiceOver custom actions (the long-press menu's twin). Only on tappable rows. */
  accessibilityActions?: { name: string; label: string }[];
  onAccessibilityAction?: (name: string) => void;
  /** Outside the tappable area, at the end of the row (an "i" button). */
  accessory?: ReactNode;
  /** Secondary text under the label (a handle). */
  detail?: string;
  /** Something before the label (an avatar). */
  leading?: ReactNode;
  label: string;
  value?: string;
  note?: string;
  onPress?: () => void;
  /** The chevron means "opens another screen or sheet": pass false on immediate actions (log out, share, delete, dev triggers). */
  chevron?: boolean;
  /** Spinner in place of the chevron (an action running). */
  loading?: boolean;
  /** "danger" colors the label red, for destructive actions; "tint" makes it an action in the brand color. */
  tone?: "danger" | "tint";
}) {
  const content = (
    <>
      {leading}
      {detail !== undefined ? (
        <View style={styles.rowLabel}>
          <Text style={[type.body, { color: colors.label }]}>{label}</Text>
          <Text style={[type.footnote, { color: colors.secondaryLabel }]}>{detail}</Text>
        </View>
      ) : (
        <Text style={[type.body, styles.rowLabel, tone === "danger" && { color: colors.danger }, tone === "tint" && { color: colors.tint }]}>{label}</Text>
      )}
      {value !== undefined && (
        <View style={styles.rowValueBox}>
          <Text selectable style={[type.body, styles.rowValue]}>
            {value}
          </Text>
          {note !== undefined && <Text style={[type.footnote, styles.rowNote]}>{note}</Text>}
        </View>
      )}
      {loading ? (
        <ActivityIndicator />
      ) : (
        onPress && chevron && <SymbolView name="chevron.right" size={14} weight="semibold" tintColor={colors.tertiaryLabel as string} />
      )}
    </>
  );
  if (!onPress)
    return (
      <View style={styles.row} accessibilityState={loading ? { busy: true } : undefined}>
        {content}
        {accessory}
      </View>
    );
  const pressable = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityActions={accessibilityActions?.length ? accessibilityActions : undefined}
      onAccessibilityAction={onAccessibilityAction ? ({ nativeEvent }) => onAccessibilityAction(nativeEvent.actionName) : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, accessory ? styles.rowGrow : null, pressed && { backgroundColor: colors.fill }]}
    >
      {content}
    </Pressable>
  );
  if (!accessory) return pressable;
  return (
    <View style={styles.rowWithAccessory}>
      {pressable}
      <View style={styles.rowAccessory}>{accessory}</View>
    </View>
  );
}

/** A grouped-list row with a native switch (on in the brand color: it's what's selected). */
export function SwitchRow({
  label,
  value,
  onValueChange,
  disabled,
  labelAccessory,
}: {
  /** Right after the label (an "i" button). */
  labelAccessory?: ReactNode;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      {labelAccessory ? (
        <View style={styles.labelWithAccessory}>
          <Text style={[type.body, styles.labelShrink]}>{label}</Text>
          {labelAccessory}
        </View>
      ) : (
        <Text style={[type.body, styles.rowLabel]}>{label}</Text>
      )}
      {/* Native SwiftUI toggle in a content-sized host: RN's Switch reserves 51x31 and draws off-center on iOS 26. */}
      <Host matchContents>
        <Toggle
          isOn={value}
          onIsOnChange={onValueChange}
          modifiers={[
            labelsHidden(),
            tint(colors.tint as string),
            disabledModifier(!!disabled),
            accessibilityLabel(label),
          ]}
        />
      </Host>
    </View>
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
  prefixed: { flexDirection: "row", alignItems: "center" },
  prefixedInput: { flex: 1, minHeight: 50, color: colors.label },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.label, paddingHorizontal: spacing.xs },
  group: { backgroundColor: colors.cell, borderRadius: radius.lg, borderCurve: "continuous", overflow: "hidden" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 50, paddingHorizontal: spacing.md },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowGrow: { flex: 1 },
  rowWithAccessory: { flexDirection: "row", alignItems: "center", paddingRight: spacing.md },
  rowAccessory: { paddingLeft: spacing.sm },
  labelWithAccessory: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  labelShrink: { flexShrink: 1, color: colors.label },
  rowLabel: { flex: 1, color: colors.label },
  rowValueBox: { alignItems: "flex-end", paddingVertical: spacing.xs },
  rowNote: { color: colors.tertiaryLabel },
  rowValue: { color: colors.secondaryLabel, fontVariant: ["tabular-nums"] },
});
