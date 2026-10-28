import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mediaSource } from "@/features/media/revealed";
import { colors, radius, spacing, type } from "@/ui/theme";

const THUMB = 56;

/** A photo thumbnail (ThumbHash while it loads) from the authed media source. */
export function ActivityThumb({ path, hash, token, id }: { path: string; hash: string | null; token: string | null; id: string }) {
  return (
    <View style={styles.thumb}>
      {token && (
        <Image
          source={mediaSource(path, token)}
          placeholder={hash ? { thumbhash: hash } : undefined}
          transition={120}
          contentFit="cover"
          recyclingKey={id}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

/** A tappable activity row: something before (photo or avatar), up to two lines of text with the time under it, something after. */
export function ActivityRow({
  leading,
  title,
  titleLines = 1,
  detail,
  trailing,
  label,
  onPress,
}: {
  leading: React.ReactNode;
  title: string;
  titleLines?: number;
  detail: string;
  trailing?: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}
    >
      {leading}
      <View style={styles.text}>
        <Text style={[type.body, { color: colors.label }]} numberOfLines={titleLines}>
          {title}
        </Text>
        <Text style={[type.footnote, { color: colors.secondaryLabel }]}>{detail}</Text>
      </View>
      {trailing}
      <SymbolView name="chevron.right" size={14} weight="semibold" tintColor={colors.tertiaryLabel as string} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 72, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  text: { flex: 1, gap: 2 },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.latent },
});
