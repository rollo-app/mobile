import { Stack } from "expo-router";
import { useSearchBar } from "@/features/friends/use-search-bar";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Footnote, Loading, Screen, Section } from "@/ui/components";
import { MemberRow } from "./member-row";
import { filterMembers, orderMembers } from "./members-order";
import { useMemberActions } from "./use-member-actions";

/** "Integrantes": everyone in the roll, same order and row behavior as "En el rollo", with a native search. */
export function MembersScreen({ tripId }: { tripId: string }) {
  const { detail, error, refetch, isRefetching } = useTripDetail(tripId);
  const text = useSearchBar();
  const actions = useMemberActions(tripId);
  const members = detail ? filterMembers(orderMembers(detail.members, detail.me.id), text) : [];

  return (
    <Screen grouped>
      <Stack.Screen options={{ title: "Integrantes" }} />
      {error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !detail && <Loading />}
      {detail && members.length === 0 && <Footnote>No hay integrantes con ese nombre.</Footnote>}
      {detail && members.length > 0 && (
        <Section>
          {members.map((m) => (
            <MemberRow key={m.id} me={detail.me} member={m} onAction={actions.run} />
          ))}
        </Section>
      )}
      {actions.failure && <ErrorText>{actions.failure}</ErrorText>}
    </Screen>
  );
}
