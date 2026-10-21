import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Fragment, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/features/profile/avatar";
import { formatHandle } from "@/features/profile/username";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { tripKey, useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Footnote, Loading, Screen } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";
import { addFriendsToTrip, type Friend } from "./actions";
import { useFriends } from "./use-friends";

/** "Sumar amigos" (sheet): pick friends and they join the active roll directly. */
export function AddFriendsSheet() {
  const queryClient = useQueryClient();
  const { trip } = useActiveTrip();
  const { detail } = useTripDetail(trip?.id);
  const { friends, error: loadError, refetch, isRefetching } = useFriends();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const members = new Set(detail?.members.map((m) => m.userId));

  function toggle(id: string) {
    setError(null);
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!trip) return;
    setError(null);
    setSaving(true);
    try {
      const results = await addFriendsToTrip(trip.id, [...picked]);
      await queryClient.invalidateQueries({ queryKey: tripKey(trip.id) });
      const failed = results.filter((r) => r.status === "unavailable").map((r) => r.userId);
      if (failed.length === 0) {
        router.back();
        return;
      }
      setUnavailable((current) => new Set([...current, ...failed]));
      setPicked(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo sumar a tus amigos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen grouped>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {saving ? (
          <Stack.Toolbar.View>
            <ActivityIndicator />
          </Stack.Toolbar.View>
        ) : (
          <Stack.Toolbar.Button variant="done" disabled={picked.size === 0} onPress={submit}>
            Sumar
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>

      {loadError && (
        <>
          <ErrorText>{loadError}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!loadError && !friends && <Loading />}
      {friends && friends.length === 0 && (
        <View style={styles.empty}>
          <Footnote>Todavía no tenés amigos para sumar. Invitá a alguien y va a aparecer acá.</Footnote>
          <Button label="Ir a Amigos" variant="secondary" onPress={() => router.replace("/friends")} />
        </View>
      )}
      {friends && friends.length > 0 && (
        <View style={styles.group}>
          {friends.map((f, i) => (
            <Fragment key={f.id}>
              {i > 0 && <View style={styles.separator} />}
              <PickRow
                friend={f}
                state={members.has(f.id) ? "member" : unavailable.has(f.id) ? "unavailable" : "free"}
                checked={picked.has(f.id)}
                onPress={() => toggle(f.id)}
              />
            </Fragment>
          ))}
        </View>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

function PickRow({
  friend,
  state,
  checked,
  onPress,
}: {
  friend: Friend;
  state: "free" | "member" | "unavailable";
  checked: boolean;
  onPress: () => void;
}) {
  const disabled = state !== "free";
  const note = state === "member" ? "Ya está" : state === "unavailable" ? "No disponible" : undefined;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={friend.name}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}
    >
      <Avatar id={friend.id} name={friend.name} avatarUrl={friend.avatarUrl} size={40} />
      <View style={styles.text}>
        <Text style={[type.body, { color: disabled ? colors.secondaryLabel : colors.label }]}>{friend.name}</Text>
        {friend.username && <Text style={[type.footnote, { color: colors.secondaryLabel }]}>{formatHandle(friend.username)}</Text>}
      </View>
      {note ? (
        <Text style={[type.body, { color: colors.secondaryLabel }]}>{note}</Text>
      ) : (
        checked && <SymbolView name="checkmark" size={16} weight="semibold" tintColor={colors.tint as string} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { gap: spacing.md },
  group: { backgroundColor: colors.cell, borderRadius: radius.lg, borderCurve: "continuous", overflow: "hidden" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 56, paddingHorizontal: spacing.md },
  text: { flex: 1 },
});
