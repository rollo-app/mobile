import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "@/ui/badge";
import { colors, spacing, type } from "@/ui/theme";
import { Avatar } from "./avatar";
import { badgeLabel, badgeSpoken } from "./badge";
import { emptyStatsText, mutualText, spokenStats, statParts, type ProfileStatsInput } from "./profile-stats";
import { formatHandle } from "./username";

type Props = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  /** Badge the server assigned by hand (`founder`, `first_edition`); unknown values show nothing. */
  badge?: string | null;
  /** The numbers line (rolls · photos · friends) and, on someone else's profile, the mutual friends; tapping the friends opens the list. Without it no line is drawn. */
  stats?: ProfileStatsInput & { onPressFriends: () => void };
};

/** Top of a profile (yours or someone's): no card, straight on the screen background (the screen's 16 pt padding is the only margin), everything centered: photo, name, @ and badge, the description, then the numbers line ("8 rollos · 34 fotos · 12 amigos") and the mutual friends under it. */
export function ProfileHeader({ id, name, username, avatarUrl, bio, badge, stats }: Props) {
  const badgeText = badgeLabel(badge);
  const parts = stats ? statParts(stats) : [];
  const emptyText = stats ? emptyStatsText(stats) : null;
  const mutual = stats ? mutualText(stats.mutual) : null;
  return (
    <View testID="profile-header" style={styles.header}>
      <Avatar id={id} name={name} avatarUrl={avatarUrl} size={96} />
      {name.trim() !== "" && (
        <Text testID="profile-name" numberOfLines={3} style={[type.title, styles.centered, { color: colors.label }]}>
          {name}
        </Text>
      )}
      {(!!username || !!badgeText) && (
        <View testID="profile-handle-row" style={styles.handleRow}>
          {!!username && (
            <Text testID="profile-username" numberOfLines={1} ellipsizeMode="middle" style={[type.subhead, styles.handle, { color: colors.secondaryLabel }]}>
              {formatHandle(username)}
            </Text>
          )}
          {badgeText ? (
            <View accessible accessibilityLabel={`Insignia: ${badgeSpoken(badgeText)}`}>
              <Badge variant="neutral" label={badgeText} />
            </View>
          ) : null}
        </View>
      )}
      {bio ? (
        <Text testID="profile-bio" style={[type.body, styles.centered, styles.bio, { color: colors.label }]}>
          {bio}
        </Text>
      ) : null}
      {stats && parts.length > 0 ? (
        // Facts, not actions: label and secondary text, never the tint.
        <Text testID="profile-stats" accessibilityLabel={spokenStats(parts)} style={[type.subhead, styles.centered, { color: colors.secondaryLabel }]}>
          {parts.map((p, i) => (
            <Fragment key={p.kind}>
              {i > 0 ? " · " : null}
              <Text
                {...(p.kind === "friends" ? { onPress: stats.onPressFriends, accessibilityRole: "button" as const, accessibilityLabel: `${p.count} ${p.word}` } : {})}
              >
                <Text style={styles.count}>{p.count}</Text> {p.word}
              </Text>
            </Fragment>
          ))}
        </Text>
      ) : null}
      {stats && parts.length === 0 && emptyText ? (
        <Pressable testID="profile-stats" accessibilityRole="button" accessibilityLabel={emptyText} onPress={stats.onPressFriends} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[type.subhead, styles.centered, { color: colors.secondaryLabel }]}>{emptyText}</Text>
        </Pressable>
      ) : null}
      {mutual ? (
        <Pressable testID="profile-mutual" accessibilityRole="button" onPress={stats?.onPressFriends} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[type.footnote, styles.centered, { color: colors.secondaryLabel }]}>{mutual}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // No fill or radius: the header sits on the screen background; horizontal margin comes from `Screen` (spacing.md).
  header: { alignItems: "center", gap: spacing.sm },
  centered: { textAlign: "center" },
  handleRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: spacing.sm },
  handle: { flexShrink: 1 },
  // The bio in the system serif at body size (the quote's family, not its size).
  bio: { fontFamily: type.quote.fontFamily },
  count: { color: colors.label, fontWeight: "600" },
  pressed: { opacity: 0.5 },
});
