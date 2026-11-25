import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { API_URL } from "@/config";
import { Button } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

// Dark mode: slightly dark at the top (the status bar), clear in the middle, and melting into the black screen at the
// bottom, under the name, which sits on the photo in white.
const SCRIM_DARK = "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.75) 82%, rgba(0,0,0,1) 100%)";
// Light mode: the photo melts into the white screen instead; the name goes under it in dark text (white text would not
// read on a photo that turns white).
const SCRIM_LIGHT = "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0) 20%, rgba(255,255,255,0) 65%, rgba(255,255,255,1) 100%)";

/**
 * The full-screen invitation to a regular rollo: the cover edge to edge with the name and dates, then the description,
 * who is in, and the way in ("Unirme") or out ("Ahora no"). Follows the phone's light or dark mode: in dark the name
 * sits on the photo over black; in light the photo fades into white and the name goes under it.
 */
export function TripInvitation({
  name,
  dates,
  coverUrl,
  description,
  joined,
  revealedText,
  busy,
  error,
  onJoin,
  onClose,
}: {
  name: string;
  dates: string;
  coverUrl?: string | null;
  description?: string | null;
  /** "7 personas ya se unieron"; null when the server didn't say. */
  joined: string | null;
  /** Set when the rollo was already revealed: shown instead of the join button. */
  revealedText?: string;
  busy?: boolean;
  error?: string | null;
  onJoin: () => void;
  onClose: () => void;
}) {
  const dark = useColorScheme() === "dark";
  const { width, height } = useWindowDimensions();
  // The whole vertical 3:4 photo edge to edge, but never more than ~70% of a short screen.
  const coverHeight = Math.round(Math.min(width * (4 / 3), height * 0.7));
  const titleOnPhoto = dark && !!coverUrl;
  const title = (
    <View style={[styles.title, !coverUrl && styles.titleNoCover]}>
      <Text accessibilityRole="header" style={[type.largeTitle, titleOnPhoto ? styles.onPhoto : styles.label]}>
        {name}
      </Text>
      <Text style={[type.subhead, titleOnPhoto ? styles.onPhotoSecondary : styles.secondary]}>{dates}</Text>
    </View>
  );

  return (
    <ScrollView
      testID="trip-invitation"
      style={[styles.screen, { backgroundColor: dark ? "#000" : colors.background }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="never"
      bounces={false}
    >
      {coverUrl ? (
        <View testID="trip-invitation-cover" style={[styles.cover, { height: coverHeight }]}>
          <Image source={{ uri: `${API_URL}${coverUrl}` }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
          <View style={[StyleSheet.absoluteFill, { backgroundImage: dark ? SCRIM_DARK : SCRIM_LIGHT }]} />
          {titleOnPhoto ? title : null}
        </View>
      ) : null}
      {titleOnPhoto ? null : title}
      <View style={styles.body}>
        {!!description && <Text style={[type.quote, dark ? styles.onDarkBody : styles.label]}>{description}</Text>}
        {revealedText ? (
          <Text style={[type.subhead, styles.secondary]}>{revealedText}</Text>
        ) : (
          joined !== null && <Text style={[type.footnote, styles.secondary, styles.people]}>{joined}</Text>
        )}
        {!!error && <Text style={[type.footnote, styles.error]}>{error}</Text>}
        <View style={styles.actions}>
          {!revealedText && <Button label="Unirme" onPress={onJoin} loading={busy} />}
          <Pressable accessibilityRole="button" accessibilityLabel={revealedText ? "Cerrar" : "Ahora no"} onPress={onClose} style={styles.close}>
            <Text style={[type.body, styles.secondary]}>{revealedText ? "Cerrar" : "Ahora no"}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  cover: { width: "100%", justifyContent: "flex-end" },
  title: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  // Without a photo the title starts below the (transparent) header.
  titleNoCover: { paddingTop: 72 },
  onPhoto: { color: "#fff" },
  onPhotoSecondary: { color: "rgba(255,255,255,0.85)" },
  label: { color: colors.label },
  secondary: { color: colors.secondaryLabel },
  onDarkBody: { color: "rgba(255,255,255,0.88)" },
  body: { paddingHorizontal: 18, paddingTop: spacing.md, gap: spacing.md },
  people: { fontVariant: ["tabular-nums"] },
  error: { color: colors.danger },
  actions: { gap: spacing.sm, paddingTop: spacing.sm },
  close: { alignItems: "center", paddingVertical: spacing.md },
});
