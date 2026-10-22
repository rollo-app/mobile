import { StyleSheet, View } from "react-native";
import { Avatar } from "@/features/profile/avatar";
import { colors } from "@/ui/theme";
import type { FeaturedPhoto } from "./actions";

const SIZE = 22;
const BORDER = 1.5;

/**
 * Who took a featured photo the profile's owner didn't: their photo (or initial on their color), small,
 * in the bottom-left corner of the thumbnail, ringed in the background color so it reads over any photo.
 */
export function AuthorBadge({ author }: { author: NonNullable<FeaturedPhoto["author"]> }) {
  return (
    <View testID="featured-author" accessible accessibilityLabel={`Foto de ${author.name}`} style={styles.badge}>
      <Avatar id={author.id} name={author.name} avatarUrl={author.avatarUrl} size={SIZE} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    borderRadius: (SIZE + BORDER * 2) / 2,
    borderWidth: BORDER,
    borderColor: colors.background,
  },
});
