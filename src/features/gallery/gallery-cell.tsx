import { featureActionAvailable } from "@/features/featured/feature-action";
import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MomentBadge, momentBadgeCorner } from "@/features/media/moment-badge";
import { mediaSource, type RevealedPhoto } from "@/features/media/revealed";
import { colors, type } from "@/ui/theme";
import { ownPhotoActions } from "./own-photo-actions";

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

export type CellProps = {
  photo: RevealedPhoto;
  token: string | null;
  size: number;
  selecting: boolean;
  selected: boolean;
  /** Your own photo of the revealed roll: it can be archived or deleted. */
  own: boolean;
  onPress: (photo: RevealedPhoto) => void;
  onToggleFeatured: (photo: RevealedPhoto) => void;
  onOwnAction: (photo: RevealedPhoto, action: "archive" | "unarchive" | "delete") => void;
};

/**
 * The feed is rebuilt into new photo objects on every change (featuring one photo included), so cells
 * compare what they draw instead of the object: toggling one photo re-renders only that cell.
 */
function sameCell(a: CellProps, b: CellProps) {
  return (
    a.photo.id === b.photo.id &&
    a.photo.thumbPath === b.photo.thumbPath &&
    a.photo.thumbhash === b.photo.thumbhash &&
    a.photo.type === b.photo.type &&
    a.photo.durationS === b.photo.durationS &&
    a.photo.author.name === b.photo.author.name &&
    a.photo.featuredByMe === b.photo.featuredByMe &&
    a.photo.momentDay === b.photo.momentDay &&
    a.photo.archived === b.photo.archived &&
    a.photo.canFeature === b.photo.canFeature &&
    a.own === b.own &&
    a.onOwnAction === b.onOwnAction &&
    a.token === b.token &&
    a.size === b.size &&
    a.selecting === b.selecting &&
    a.selected === b.selected &&
    a.onPress === b.onPress &&
    a.onToggleFeatured === b.onToggleFeatured
  );
}

export const Cell = memo(function Cell({ photo, token, size, selecting, selected, own, onPress, onToggleFeatured, onOwnAction }: CellProps) {
  const cell = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${photo.type === "video" ? "Video" : "Foto"} de ${photo.author.name}`}
      accessibilityState={selecting ? { selected } : undefined}
      onPress={() => onPress(photo)}
      style={{ width: size, height: size, backgroundColor: colors.latent }}
    >
      {token && (
        <Image
          source={mediaSource(photo.thumbPath, token)}
          placeholder={photo.thumbhash ? { thumbhash: photo.thumbhash } : undefined}
          transition={120}
          contentFit="cover"
          recyclingKey={photo.id}
          // Archived: only you see it, so it shows dimmed.
          style={[StyleSheet.absoluteFill, photo.archived && styles.archived]}
        />
      )}
      {photo.momentDay && <MomentBadge style={momentBadgeCorner} />}
      {photo.archived && (
        <View style={styles.archivedBadge}>
          <Text style={[type.caption, styles.archivedText]}>Archivada</Text>
        </View>
      )}
      {photo.type === "video" && (
        <View style={styles.video}>
          <SymbolView name="play.fill" size={10} tintColor="#FFFFFF" />
          {photo.durationS !== null && (
            <Text style={[type.caption, styles.videoText]}>{formatDuration(photo.durationS)}</Text>
          )}
        </View>
      )}
      {selecting && (
        <View
          style={[
            styles.check,
            selected && {
              backgroundColor: colors.tint,
              borderColor: colors.tint,
            },
          ]}
        >
          {selected && <SymbolView name="checkmark" size={12} weight="bold" tintColor={colors.onTint as string} />}
        </View>
      )}
    </Pressable>
  );
  // Long press opens the native context menu: featuring (videos and photos you can't feature have nothing to offer)
  // and, on your own photos, archive and delete. Selecting has its own taps.
  const actions: MenuAction[] = [
    ...(photo.type === "photo" && featureActionAvailable(photo)
      ? [
          photo.featuredByMe
            ? ({ id: "unfeature", title: "Sacar de tu perfil", image: "person.crop.circle.badge.minus" } as MenuAction)
            : ({ id: "feature", title: "Agregar a tu perfil", image: "person.crop.circle.badge.plus" } as MenuAction),
        ]
      : []),
    ...(own ? ownPhotoActions(photo) : []),
  ];
  if (selecting || actions.length === 0) return cell;
  return (
    <MenuView
      shouldOpenOnLongPress
      style={{ width: size, height: size }}
      actions={actions}
      onPressAction={({ nativeEvent }) => {
        const event = nativeEvent.event;
        if (event === "archive" || event === "unarchive" || event === "delete") onOwnAction(photo, event);
        else onToggleFeatured(photo);
      }}
    >
      {cell}
    </MenuView>
  );
}, sameCell);

const styles = StyleSheet.create({
  video: {
    position: "absolute",
    left: 4,
    bottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  archived: { opacity: 0.35 },
  archivedBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  archivedText: { color: "#FFFFFF" },
  videoText: {
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 2,
  },
  check: {
    position: "absolute",
    right: 5,
    bottom: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
});
