import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";
import { Avatar } from "./avatar";
import { formatFriendCount } from "./friend-count";
import { formatHandle } from "./username";

type Props = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  /** How many friends (and, on someone else's profile, how many in common); tapping it opens the list. */
  friends?: { count: number; mutual?: number; canSee?: boolean; onPress: () => void };
};

/** Top of a profile (yours or someone's): photo, name, @, the description when there is one and the friend count. */
export function ProfileHeader({ id, name, username, avatarUrl, bio, friends }: Props) {
  const friendCount = friends ? formatFriendCount(friends.count, friends.mutual, friends.canSee) : null;
  return (
    <View style={styles.header}>
      <Avatar id={id} name={name} avatarUrl={avatarUrl} size={72} />
      <Text style={[type.title, styles.center, { color: colors.label }]}>{name}</Text>
      {username && <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{formatHandle(username)}</Text>}
      {bio ? (
        <Text testID="profile-bio" style={[type.body, styles.center, styles.bio, { color: colors.label }]}>
          {bio}
        </Text>
      ) : null}
      {friends && friendCount && (
        // A fact, not an action: secondary text, never the tint.
        <Pressable accessibilityRole="button" onPress={friends.onPress} hitSlop={8} style={({ pressed }) => [styles.count, pressed && styles.pressed]}>
          <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{friendCount}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  center: { textAlign: "center" },
  bio: { marginTop: spacing.xs },
  count: { marginTop: spacing.xs },
  pressed: { opacity: 0.5 },
});
