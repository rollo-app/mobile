import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { API_URL } from "@/config";
import { Button } from "@/ui/components";
import { spacing, type } from "@/ui/theme";

// Slightly dark at the top (the status bar), clear in the middle, and melting into the black screen at the bottom
// (under the name), so the photo has no hard edge.
const SCRIM = "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.75) 82%, rgba(0,0,0,1) 100%)";

/**
 * The full-screen invitation to a regular rollo: the cover edge to edge with the name and dates over it, then the
 * description, who is in, and the way in ("Unirme") or out ("Ahora no"). Always on black, in light and dark mode.
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
  const { width, height } = useWindowDimensions();
  // The whole vertical 3:4 photo edge to edge, but never more than ~70% of a short screen.
  const coverHeight = Math.round(Math.min(width * (4 / 3), height * 0.7));
  return (
    <ScrollView testID="trip-invitation" style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never" bounces={false}>
      <View testID="trip-invitation-cover" style={[styles.cover, { height: coverHeight }]}>
        {coverUrl ? (
          <>
            <Image source={{ uri: `${API_URL}${coverUrl}` }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
            <View style={[StyleSheet.absoluteFill, styles.scrim]} />
          </>
        ) : null}
        <View style={styles.title}>
          <Text accessibilityRole="header" style={[type.largeTitle, styles.name]}>
            {name}
          </Text>
          <Text style={[type.subhead, styles.dates]}>{dates}</Text>
        </View>
      </View>
      <View style={styles.body}>
        {!!description && <Text style={[type.quote, styles.description]}>{description}</Text>}
        {revealedText ? (
          <Text style={[type.subhead, styles.muted]}>{revealedText}</Text>
        ) : (
          joined !== null && <Text style={[type.footnote, styles.people]}>{joined}</Text>
        )}
        {!!error && <Text style={[type.footnote, styles.error]}>{error}</Text>}
        <View style={styles.actions}>
          {!revealedText && <Button label="Unirme" onPress={onJoin} loading={busy} />}
          <Pressable accessibilityRole="button" accessibilityLabel={revealedText ? "Cerrar" : "Ahora no"} onPress={onClose} style={styles.close}>
            <Text style={[type.body, styles.closeLabel]}>{revealedText ? "Cerrar" : "Ahora no"}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  content: { paddingBottom: spacing.xl },
  cover: { width: "100%", backgroundColor: "#000", justifyContent: "flex-end" },
  scrim: { backgroundImage: SCRIM },
  title: { padding: spacing.lg, gap: spacing.xs },
  name: { color: "#fff" },
  dates: { color: "rgba(255,255,255,0.85)" },
  body: { paddingHorizontal: 18, paddingTop: spacing.lg, gap: spacing.md },
  description: { color: "rgba(255,255,255,0.88)" },
  people: { color: "rgba(255,255,255,0.6)", fontVariant: ["tabular-nums"] },
  muted: { color: "rgba(255,255,255,0.7)" },
  error: { color: "#ff6961" },
  actions: { gap: spacing.sm, paddingTop: spacing.sm },
  close: { alignItems: "center", paddingVertical: spacing.md },
  closeLabel: { color: "rgba(255,255,255,0.7)" },
});
