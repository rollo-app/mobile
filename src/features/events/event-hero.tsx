import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { API_URL } from "@/config";
import { radius, spacing, type } from "@/ui/theme";

// Darkens only the bottom of the photo, so the white text reads on any cover.
const SCRIM = "linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)";

/**
 * An event's cover as the hero of the screen: the photo large, with the event's name (and an eyebrow or a day) over a
 * dark fade at the bottom. Used when joining, at the top of the event's board and as the preview in Crear evento; without a cover, nothing.
 */
export function EventHero({
  name,
  coverUrl,
  eyebrow,
  caption,
}: {
  name: string;
  /** The cover's path on the server, or a local `file://` photo (the preview in Crear evento, before it is uploaded). */
  coverUrl: string;
  /** Small line above the name ("Te invitaron a"). */
  eyebrow?: string;
  /** Small line below the name (the day). */
  caption?: string;
}) {
  return (
    <View testID="event-hero" style={styles.frame}>
      <Image source={{ uri: coverUrl.startsWith("file:") ? coverUrl : `${API_URL}${coverUrl}` }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <View style={styles.text}>
        {eyebrow ? <Text style={[type.subhead, styles.secondary]}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" numberOfLines={3} style={[type.largeTitle, styles.name]}>
          {name}
        </Text>
        {caption ? <Text style={[type.subhead, styles.secondary]}>{caption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // A fixed dark fill while the photo loads, in light and dark mode alike: the text over it is always white.
  // Square, like the crop the organizer framed.
  frame: { width: "100%", aspectRatio: 1, borderRadius: radius.lg, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#1c1c1e", justifyContent: "flex-end" },
  scrim: { backgroundImage: SCRIM },
  text: { padding: spacing.lg, gap: spacing.xs },
  name: { color: "#fff" },
  secondary: { color: "rgba(255,255,255,0.85)" },
});
