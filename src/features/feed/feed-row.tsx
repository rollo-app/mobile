import { MenuView } from "@expo/ui/community/menu";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MapItem } from "@/features/map/features";
import { memberColor } from "@/features/map/member-color";
import { colors, radius, spacing, type } from "@/ui/theme";

const AVATAR = 36;
const THUMB = 56;

const DELETE_ACTIONS = [{ id: "delete", title: "Borrar foto", attributes: { destructive: true } }];

/** Hora de captura "14:32" en la zona del viaje. */
export function clockTime(takenAt: number, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(takenAt);
}

type Props = {
  item: MapItem;
  timeZone: string;
  /** Tocar una fila con ubicación (lleva al mapa). Sin ubicación la fila no es tocable. */
  onPress?: (item: MapItem) => void;
  /** Solo para el admin: habilita el menú "Borrar foto" al mantener apretada la fila. */
  onDelete?: (item: MapItem) => void;
};

/** Una fila nativa del Feed: quién, cuándo, el caption (o qué sacó) y la foto borrosa. */
export const FeedRow = memo(function FeedRow({ item, timeZone, onPress, onDelete }: Props) {
  const when = clockTime(item.takenAt, timeZone);
  const generic = item.type === "video" ? `sacó un video · ${Math.round(item.durationS ?? 0)} s` : "sacó una foto";
  const located = item.lat !== null && item.lng !== null;

  const content = (
    <View testID="feed-row" style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: memberColor(item.authorId) }]}>
        <Text style={[type.callout, styles.initial]}>{item.authorName.trim().charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.text}>
        <Text numberOfLines={1} style={[type.footnote, { color: colors.secondaryLabel }]}>
          <Text style={{ fontWeight: "600", color: colors.label }}>{item.authorName}</Text>
          {" · "}
          <Text>{when}</Text>
        </Text>
        {item.caption ? (
          <Text numberOfLines={3} style={[type.quote, { color: colors.label }]}>
            {item.caption}
          </Text>
        ) : (
          <Text style={[type.body, { color: colors.label }]}>{generic}</Text>
        )}
        {item.pending ? <Text style={[type.footnote, { color: colors.secondaryLabel }]}>Esperando señal</Text> : null}
      </View>
      {item.thumbhash ? (
        <Image testID="feed-thumb" placeholder={{ thumbhash: item.thumbhash }} style={styles.thumb} accessibilityIgnoresInvertColors />
      ) : (
        <View testID="feed-thumb-empty" style={[styles.thumb, { backgroundColor: colors.latent }]} />
      )}
    </View>
  );

  const touchable = located && onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.authorName}, ${when}`}
      accessibilityHint="Abre la foto en el mapa"
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.fill, pressed && { backgroundColor: colors.fill }]}
    >
      {content}
    </Pressable>
  ) : (
    content
  );

  if (!onDelete || item.pending) return touchable;
  return (
    <MenuView style={styles.fill} shouldOpenOnLongPress actions={DELETE_ACTIONS} onPressAction={() => onDelete(item)}>
      {touchable}
    </MenuView>
  );
});

const styles = StyleSheet.create({
  // Todos los envoltorios (Pressable, MenuView) ocupan el ancho: así la miniatura queda siempre a la derecha.
  fill: { alignSelf: "stretch" },
  row: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignItems: "center", justifyContent: "center" },
  initial: { color: "#FFFFFF", fontWeight: "600" },
  text: { flex: 1, gap: 2 },
  thumb: { flexShrink: 0, width: THUMB, height: THUMB, borderRadius: radius.sm, borderCurve: "continuous" },
});
