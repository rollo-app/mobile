import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { colors, spacing } from "@/ui/theme";

const ICON_SIZE = 24;

/** Rollo Project's accounts. The https links open the network's app when it's installed. */
const ACCOUNTS = [
  { network: "Instagram", url: "https://www.instagram.com/rolloproject", icon: require("../../../assets/share/instagram-mono.png") },
  { network: "TikTok", url: "https://www.tiktok.com/@rolloproject", icon: require("../../../assets/share/tiktok-mono.png") },
] as const;

/** Small gray logos linking to Rollo Project's social accounts, for the foot of the welcome screen. */
export function SocialLinks() {
  return (
    <View style={styles.row}>
      {ACCOUNTS.map(({ network, url, icon }) => (
        <Pressable
          key={network}
          accessibilityRole="link"
          accessibilityLabel={`Rollo Project en ${network}`}
          onPress={() => void Linking.openURL(url)}
          hitSlop={10}
        >
          {({ pressed }) => <Image source={icon} style={[styles.icon, { opacity: pressed ? 0.5 : 1 }]} />}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: spacing.xl },
  icon: { width: ICON_SIZE, height: ICON_SIZE, tintColor: colors.secondaryLabel },
});
