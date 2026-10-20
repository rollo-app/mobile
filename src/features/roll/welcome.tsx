import { router } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMe } from "@/features/auth/use-me";
import { Avatar } from "@/features/profile/avatar";
import { formatHandle } from "@/features/profile/username";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { Button, ErrorText } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

/** The Rollo tab for someone who is in no roll yet: who they are and the two ways in. */
export function Welcome() {
  const { me } = useMe();
  const { error, refetch } = useActiveTrip();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {me && (
        <View style={styles.who}>
          <Avatar id={me.id} name={me.name} avatarUrl={me.avatarUrl} size={72} />
          <Text style={[type.headline, { color: colors.label }]}>{me.name}</Text>
          {me.username && <Text style={[type.subhead, { color: colors.secondaryLabel }]}>{formatHandle(me.username)}</Text>}
        </View>
      )}
      <View style={styles.copy}>
        <Text style={[type.title, styles.center, { color: colors.label }]}>Todavía no tenés rollos</Text>
        <Text style={[type.body, styles.center, { color: colors.secondaryLabel }]}>
          Empezá uno con tus amigos o sumate con un código.
        </Text>
      </View>
      <View style={styles.actions}>
        {error && <ErrorText>{error}</ErrorText>}
        <Button label="Empezar un nuevo rollo" onPress={() => router.push("/create")} />
        <Button label="Sumarme con un código" variant="secondary" onPress={() => router.push("/join")} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: "center", gap: spacing.xl, padding: spacing.lg },
  who: { alignItems: "center", gap: spacing.xs },
  copy: { gap: spacing.sm, alignItems: "center" },
  center: { textAlign: "center" },
  actions: { gap: spacing.sm },
});
