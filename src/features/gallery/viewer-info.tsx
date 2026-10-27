import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CommentButton } from "@/features/comments/comment-button";
import { featureActionAvailable } from "@/features/featured/feature-action";
import { LikeButton } from "@/features/likes/like-button";
import { formatPinTime } from "@/features/map/pin-time";
import type { RevealedPhoto } from "@/features/media/revealed";
import { Avatar } from "@/features/profile/avatar";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { OverlayIconButton } from "@/ui/overlay-button";
import { spacing, tintHex, type } from "@/ui/theme";
import { PermissionNotice } from "./permission-notice";
import type { SaveState } from "./use-save-photo";

/** The viewer's bottom panel: author, time, caption, the action row and the errors of the last attempts. */
export function ViewerInfo({
  photo,
  timeZone,
  bottomInset,
  readOnly,
  liking,
  featuring,
  saveState,
  canSave,
  likeError,
  featureError,
  onLike,
  onToggleFeatured,
  onSave,
}: {
  photo: RevealedPhoto;
  timeZone: string;
  bottomInset: number;
  /** A moment before the reveal: no likes, saving or featuring. */
  readOnly: boolean;
  liking: boolean;
  featuring: boolean;
  saveState: SaveState;
  canSave: boolean;
  likeError: string | null;
  featureError: string | null;
  onLike: () => void;
  onToggleFeatured: () => void;
  onSave: () => void;
}) {
  const router = useRouter();
  const openProfile = useOpenProfile();
  return (
    <View testID="viewer-info" pointerEvents="box-none" style={[styles.info, { paddingBottom: bottomInset + spacing.sm }]}>
      <View style={styles.authorRow}>
        {/* Closes the viewer and opens the author's profile over the tabs (or Perfil if it's you). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Perfil de ${photo.author.name}`}
          onPress={() => openProfile(photo.authorUserId, { leave: true })}
          style={({ pressed }) => [styles.authorRow, pressed && styles.pressed]}
        >
          <Avatar id={photo.author.id} name={photo.author.name} avatarUrl={photo.author.avatarUrl} size={40} />
          <Text style={[type.headline, styles.white]}>{photo.author.name}</Text>
        </Pressable>
        <Text style={[type.subhead, styles.dim]}>{formatPinTime(photo.takenAt, timeZone)}</Text>
        {photo.archived && <Text style={[type.subhead, styles.dim]}>Archivada</Text>}
      </View>
      {photo.caption ? <Text style={[type.quote, styles.white]}>{photo.caption}</Text> : null}
      <View style={styles.actions}>
        {photo.type === "photo" && !readOnly && (
          <LikeButton liked={photo.likedByMe} count={photo.likeCount} busy={liking} onPress={onLike} />
        )}
        {photo.type === "photo" && (
          <CommentButton
            count={photo.commentCount}
            onPress={() => router.push({ pathname: "/comments/[mediaId]", params: { mediaId: photo.id } })}
          />
        )}
        {photo.type === "photo" && !readOnly && featureActionAvailable(photo) && (
          <OverlayIconButton
            symbol={photo.featuredByMe ? "person.crop.circle.badge.checkmark" : "person.crop.circle.badge.plus"}
            symbolTestID="feature-symbol"
            label={photo.featuredByMe ? "Sacar de tu perfil" : "Agregar a tu perfil"}
            // Featured is a selection: cobalt (its dark-scheme value, since the viewer is always black).
            tint={photo.featuredByMe ? tintHex.dark : "#FFFFFF"}
            disabled={featuring}
            onPress={onToggleFeatured}
          />
        )}
        {photo.lat !== null && photo.lng !== null && (
          <OverlayIconButton
            symbol="map"
            label="Ver en el mapa"
            onPress={() => router.navigate({ pathname: "/map", params: { focus: photo.id } })}
          />
        )}
        {!readOnly && (
          <OverlayIconButton
            symbol={saveState === "saved" ? "checkmark" : "square.and.arrow.down"}
            label={saveState === "saved" ? "Guardada" : "Guardar en Fotos"}
            busy={saveState === "saving"}
            disabled={saveState === "saved" || !canSave}
            onPress={onSave}
          />
        )}
      </View>
      {likeError && <Text style={[type.footnote, styles.dim]}>{likeError}</Text>}
      {featureError && <Text style={[type.footnote, styles.dim]}>{featureError}</Text>}
      {saveState === "failed" && <Text style={[type.footnote, styles.dim]}>No se pudo guardar. Probá de nuevo.</Text>}
      {saveState === "denied" && <PermissionNotice />}
    </View>
  );
}

const styles = StyleSheet.create({
  info: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pressed: { opacity: 0.5 },
  white: { color: "#FFFFFF" },
  dim: { color: "rgba(255,255,255,0.7)" },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
});
