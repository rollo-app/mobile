import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { colors, type } from "@/ui/theme";

const SIZE = 52;
/** Thumbnails shown; the rest of the collage is summed up in the "+N" tile. */
const SHOWN = 4;

/** The first 4 photos the collage uses right now, numbered, plus a "+" to change them. Tappable only when `onPress` is given. */
export function CollageStrip({ photos, total, token, onPress, subject = "collage" }: { photos: RevealedPhoto[]; total?: number; token: string | null; onPress: (() => void) | null; subject?: "collage" | "recorrido" | "resumen" }) {
  const extra = photos.length - SHOWN;
  // The hint may count more than the strip shows (the summary's whole sheet).
  const count = total ?? photos.length;
  const content = (
    <>
      {photos.slice(0, SHOWN).map((photo, i) => (
        <View key={photo.id} style={styles.thumb}>
          {!!token && (
            <Image
              source={mediaSource(photo.thumbPath, token)}
              placeholder={photo.thumbhash ? { thumbhash: photo.thumbhash } : undefined}
              contentFit="cover"
              recyclingKey={photo.id}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={styles.badge}>
            <Text testID={`strip-badge-${photo.id}`} style={[type.caption, styles.badgeText]}>
              {i + 1}
            </Text>
          </View>
        </View>
      ))}
      {onPress !== null && (
        <View testID="strip-add" style={[styles.thumb, styles.add]}>
          {extra > 0 ? (
            <Text testID="strip-more" style={[type.subhead, styles.more]}>{`+${extra}`}</Text>
          ) : (
            <SymbolView name="plus" size={18} weight="semibold" tintColor={colors.secondaryLabel} />
          )}
        </View>
      )}
    </>
  );
  if (onPress === null) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Elegir fotos"
      accessibilityHint={`${subject === "collage" ? "El collage" : subject === "resumen" ? "El resumen" : "El recorrido"} tiene ${count === 1 ? "1 foto" : `${count} fotos`}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 6 },
  pressed: { opacity: 0.6 },
  thumb: { width: SIZE, height: SIZE, borderRadius: 6, backgroundColor: colors.latent, overflow: "visible" },
  add: { backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" },
  more: { color: colors.secondaryLabel, fontWeight: "600", fontVariant: ["tabular-nums"] },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.onTint, fontSize: 10, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
