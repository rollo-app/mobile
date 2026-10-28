import { MenuView } from "@expo/ui/community/menu";
import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { errorMessage } from "@/api/client";
import { formatDateRange } from "@/features/trips/phase";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { setActiveTripId } from "@/storage/active-trip";
import { Button, ErrorText, Footnote, Row, Section } from "@/ui/components";
import { addableTrips } from "./addable-trips";
import { useAddFriendsToTrip } from "./use-add-friends-to-trip";
import { useFriend } from "./use-friend";
import { useRemoveFriend } from "./use-remove-friend";

const NO_COMMON = "Todavía no tienen rollos en común.";

/**
 * What only a friend's profile has: the rolls you share (tap one to open it), a way to add them to one
 * of yours, and removing them as a friend. Nothing if the server says you aren't friends anymore.
 */
export function FriendSections({ userId, name }: { userId: string; name: string }) {
  const { profile, notFriend, error, refetch, isRefetching } = useFriend(userId);
  const { trips } = useActiveTrip();
  const { add, adding, error: addFailure, reset: resetAdd } = useAddFriendsToTrip();
  // The server answered but didn't add them ("unavailable"): not a request error.
  const [notAdded, setNotAdded] = useState(false);
  const remove = useRemoveFriend();
  const addError = errorMessage(addFailure, `No se pudo sumar a ${name}`) ?? (notAdded ? `No se pudo sumar a ${name}` : null);
  const removeError = errorMessage(remove.error, "No se pudo borrar al amigo");

  if (notFriend) return null;
  if (!profile) {
    return error ? (
      <>
        <ErrorText>{error}</ErrorText>
        <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
      </>
    ) : null;
  }

  const { commonTrips } = profile;
  const addable = addableTrips(trips, commonTrips);
  // The phone's zone: the common rolls don't carry theirs.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = Date.now();

  async function openTrip(tripId: string) {
    await setActiveTripId(tripId);
    router.navigate("/roll");
  }

  function addTo(tripId: string) {
    setNotAdded(false);
    resetAdd();
    add({ tripId, friendIds: [userId] }, ([result]) => setNotAdded(result?.status !== "added"));
  }

  function confirmRemove() {
    Alert.alert(`¿Borrar a ${name} de tus amigos?`, "Ya no vas a poder sumarlo a rollos. Los rollos en los que ya está no cambian.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar amigo", style: "destructive", onPress: () => remove.mutate(userId, { onSuccess: () => router.dismissTo("/friends") }) },
    ]);
  }

  return (
    <>
      {commonTrips.length === 0 && addable.length === 0 ? (
        <Footnote>{NO_COMMON}</Footnote>
      ) : (
        <Section title="Rollos en común" footer={commonTrips.length === 0 ? NO_COMMON : undefined}>
          {commonTrips.map((t) => (
            <Row
              key={t.id}
              label={t.name}
              detail={formatDateRange(t.startsAt, t.endsAt, now, timeZone)}
              value={t.revealed ? "Revelado" : undefined}
              onPress={() => void openTrip(t.id)}
            />
          ))}
          {addable.length > 0 && (
            <MenuView
              title="Sumar a un rollo"
              actions={addable.map((t) => ({ id: t.id, title: t.name, attributes: { disabled: adding } }))}
              onPressAction={({ nativeEvent }) => addTo(nativeEvent.event)}
            >
              <Row label="Sumar a un rollo" tone="tint" loading={adding} />
            </MenuView>
          )}
        </Section>
      )}
      {addError && <ErrorText>{addError}</ErrorText>}

      <Section>
        <Row label="Borrar amigo" tone="danger" chevron={false} onPress={confirmRemove} />
      </Section>
      {removeError && <ErrorText>{removeError}</ErrorText>}
    </>
  );
}
