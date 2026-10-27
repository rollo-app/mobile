import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "@/ui/badge";
import { colors, spacing, type } from "@/ui/theme";
import { Avatar } from "./avatar";
import { badgeLabel, badgeSpoken } from "./badge";
import { formatFriendCount } from "./friend-count";
import { formatHandle } from "./username";

type Props = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  /** Badge the server assigned by hand (`founder`, `first_edition`); unknown values show nothing. */
  badge?: string | null;
  /** How many friends (and, on someone else's profile, how many in common); tapping it opens the list. */
  friends?: { count: number; mutual?: number; canSee?: boolean; own?: boolean; onPress: () => void };
};

/** Top of a profile (yours or someone's): photo, name, @, the description when there is one and the friend count. */
export function ProfileHeader({ id, name, username, avatarUrl, bio, badge, friends }: Props) {
  const friendCount = friends ? formatFriendCount(friends.count, friends.mutual, friends.canSee, friends.own) : null;
  const badgeText = badgeLabel(badge);
  return (
    <View style={styles.header}>
      <Avatar id={id} name={name} avatarUrl={avatarUrl} size={72} />
      {name.trim() !== "" && (
        <Text testID="profile-name" numberOfLines={3} style={[type.title, styles.center, { color: colors.label }]}>
          {name}
        </Text>
      )}
      {badgeText && (
        <View accessible accessibilityLabel={`Insignia: ${badgeSpoken(badgeText)}`}>
          <Badge variant="neutral" label={badgeText} />
        </View>
      )}
      {username && (
        <Text testID="profile-username" numberOfLines={1} ellipsizeMode="middle" style={[type.subhead, styles.center, { color: colors.secondaryLabel }]}>
          {formatHandle(username)}
        </Text>
      )}
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
