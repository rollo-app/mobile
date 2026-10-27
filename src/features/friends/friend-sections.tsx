import { MenuView } from "@expo/ui/community/menu";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { userKey } from "@/features/profile/use-user";
import { formatDateRange } from "@/features/trips/phase";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { tripKey } from "@/features/trips/use-trip-detail";
import { setActiveTripId } from "@/storage/active-trip";
import { Button, ErrorText, Footnote, Row, Section } from "@/ui/components";
import { addFriendsToTrip, removeFriend, type Friend } from "./actions";
import { addableTrips } from "./addable-trips";
import { friendKey, useFriend } from "./use-friend";
import { friendsKey } from "./use-friends";

const NO_COMMON = "Todavía no tienen rollos en común.";

/**
 * What only a friend's profile has: the rolls you share (tap one to open it), a way to add them to one
 * of yours, and removing them as a friend. Nothing if the server says you aren't friends anymore.
 */
export function FriendSections({ userId, name }: { userId: string; name: string }) {
  const queryClient = useQueryClient();
  const { profile, notFriend, error, refetch, isRefetching } = useFriend(userId);
  const { trips } = useActiveTrip();
  const [adding, setAdding] = useState(false);
  // Guards against a second pick before `adding` re-renders the menu as disabled.
  const addInFlight = useRef(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

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

  async function addTo(tripId: string) {
    if (addInFlight.current) return;
    addInFlight.current = true;
    setAddError(null);
    setAdding(true);
    try {
      const [result] = await addFriendsToTrip(tripId, [userId]);
      if (result?.status === "added") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: friendKey(userId) }),
          queryClient.invalidateQueries({ queryKey: tripKey(tripId) }),
        ]);
      } else {
        setAddError(`No se pudo sumar a ${name}`);
      }
    } catch (e) {
      setAddError(e instanceof Error ? e.message : `No se pudo sumar a ${name}`);
    } finally {
      addInFlight.current = false;
      setAdding(false);
    }
  }

  function confirmRemove() {
    Alert.alert(`¿Borrar a ${name} de tus amigos?`, "Ya no vas a poder sumarlo a rollos. Los rollos en los que ya está no cambian.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar amigo", style: "destructive", onPress: () => void remove() },
    ]);
  }

  async function remove() {
    setRemoveError(null);
    try {
      await removeFriend(userId);
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : "No se pudo borrar al amigo");
      return;
    }
    queryClient.setQueryData<Friend[]>(friendsKey, (current) => current?.filter((f) => f.id !== userId));
    // Their profile (and what you can see of it) changed; the friend cache isn't removed here: doing it
    // during the dismiss would refetch it and get a 404. It's garbage-collected once the screen unmounts.
    void queryClient.invalidateQueries({ queryKey: userKey(userId), refetchType: "none" });
    router.dismissTo("/friends");
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
              onPressAction={({ nativeEvent }) => void addTo(nativeEvent.event)}
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
