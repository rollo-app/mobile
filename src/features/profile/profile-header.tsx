import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type } from "@/ui/theme";
import { Avatar } from "./avatar";
import { formatHandle } from "./username";

type Props = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
};

/** Top of a profile (yours or a friend's): photo, name, @ and the description when there is one. */
export function ProfileHeader({ id, name, username, avatarUrl, bio }: Props) {
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
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  center: { textAlign: "center" },
  bio: { marginTop: spacing.xs },
});
