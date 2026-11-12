import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "./theme";

type Props = {
  /** The next page is on its way. */
  loading: boolean;
  /** The last attempt to load the next page failed. */
  error: boolean;
  onRetry: () => void;
  testID?: string;
};

/** The end of a list that loads in pages: a spinner while the next page loads, or the failure with "Reintentar". Nothing otherwise. */
export function LoadMoreFooter({ loading, error, onRetry, testID }: Props) {
  if (loading) return <ActivityIndicator testID={testID} style={styles.footer} />;
  if (!error) return null;
  return (
    <View style={styles.footer}>
      <Text style={[type.subhead, { color: colors.secondaryLabel }]}>No se pudieron cargar más fotos.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Reintentar" hitSlop={10} onPress={onRetry}>
        <Text style={[type.headline, { color: colors.tint }]}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: "center", gap: spacing.sm, padding: spacing.lg },
});
