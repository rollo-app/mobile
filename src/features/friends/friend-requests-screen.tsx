import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/features/profile/avatar";
import { formatHandle } from "@/features/profile/username";
import { Button, ErrorText, Footnote, Loading, Row, Screen, Section } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";
import type { FriendRequest } from "./actions";
import { useFriendRequest } from "./use-friend-request";
import { useFriendRequestsList } from "./use-friend-requests";

/** All received friend requests, with accept / reject per row. Opens from the "Solicitudes" row in the Amigos tab. */
export function FriendRequestsScreen() {
  const { requests, error, refetch, isRefetching } = useFriendRequestsList();
  return (
    <Screen grouped>
      {error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !requests && <Loading />}
      {requests && requests.length === 0 && <Footnote>No tenés solicitudes pendientes.</Footnote>}
      {requests && requests.length > 0 && (
        <Section>
          {requests.map((r) => (
            <RequestRow key={r.user.id} request={r} />
          ))}
        </Section>
      )}
    </Screen>
  );
}

function RequestRow({ request }: { request: FriendRequest }) {
  const { user } = request;
  const answer = useFriendRequest(user.id);
  return (
    <View>
      <Row
        leading={<Avatar id={user.id} name={user.name} avatarUrl={user.avatarUrl} size={40} />}
        label={user.name}
        detail={user.username ? formatHandle(user.username) : undefined}
        onPress={() => router.push(`/friends/user/${user.id}`)}
      />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Aceptar solicitud de ${user.name}`}
          disabled={answer.busy}
          onPress={answer.accept}
          style={[styles.action, { backgroundColor: colors.tint, opacity: answer.busy ? 0.35 : 1 }]}
        >
          <Text style={[type.subhead, styles.accept]}>Aceptar</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Rechazar solicitud de ${user.name}`}
          disabled={answer.busy}
          onPress={answer.reject}
          style={[styles.action, { backgroundColor: colors.fill, opacity: answer.busy ? 0.35 : 1 }]}
        >
          <Text style={[type.subhead, { color: colors.label, fontWeight: "600" }]}>Rechazar</Text>
        </Pressable>
      </View>
      {answer.error && (
        <View style={styles.error}>
          <ErrorText>{answer.error}</ErrorText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  action: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: spacing.sm, borderRadius: radius.sm },
  accept: { color: colors.onTint, fontWeight: "600" },
  error: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
