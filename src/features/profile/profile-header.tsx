import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "@/ui/badge";
import { colors, radius, spacing, type } from "@/ui/theme";
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

/** Top of a profile (yours or someone's): a borderless card: photo on the left, name, @ and badge on the right, the description and the friend count below. */
export function ProfileHeader({ id, name, username, avatarUrl, bio, badge, friends }: Props) {
  const friendCount = friends ? formatFriendCount(friends.count, friends.mutual, friends.canSee, friends.own) : null;
  const badgeText = badgeLabel(badge);
  return (
    <View style={styles.card}>
      <View testID="profile-row" style={styles.row}>
        <View style={styles.avatar}>
          <Avatar id={id} name={name} avatarUrl={avatarUrl} size={64} />
        </View>
        <View style={styles.identity}>
          {name.trim() !== "" && (
            <Text testID="profile-name" numberOfLines={3} style={[type.title3, { color: colors.label }]}>
              {name}
            </Text>
          )}
          {username && (
            <Text testID="profile-username" numberOfLines={1} ellipsizeMode="middle" style={[type.subhead, { color: colors.secondaryLabel }]}>
              {formatHandle(username)}
            </Text>
          )}
          {badgeText && (
            <View accessible accessibilityLabel={`Insignia: ${badgeSpoken(badgeText)}`} style={styles.badge}>
              <Badge variant="neutral" label={badgeText} />
            </View>
          )}
        </View>
      </View>
      {bio ? (
        <Text testID="profile-bio" style={[type.body, { color: colors.label }]}>
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
  // Borderless card: the grouped-list cell color against the grouped screen background (both screens are `grouped`).
  card: { backgroundColor: colors.cell, borderRadius: radius.lg, borderCurve: "continuous", padding: spacing.md, gap: spacing.sm },
  // Top-aligned: with a name that wraps to 3 lines the column grows down and the photo stays at the top.
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  avatar: { flexShrink: 0 },
  // Short column (name + @): centered against the 64 pt photo via minHeight, grows naturally when the name wraps.
  identity: { flex: 1, minWidth: 0, minHeight: 64, justifyContent: "center", gap: 2 },
  badge: { alignSelf: "flex-start", marginTop: spacing.xs },
  count: { alignSelf: "flex-start" },
  pressed: { opacity: 0.5 },
});
