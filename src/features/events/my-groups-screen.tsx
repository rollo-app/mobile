import { router } from "expo-router";
import { useState } from "react";
import { errorMessage } from "@/api/client";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Footnote, Loading, Screen } from "@/ui/components";
import { PickGroups } from "./pick-groups";
import { useSetMyGroups } from "./use-set-my-groups";

/** "Sumarme a otro grupo": the guest changes the groups they're in (at least one). */
export function MyGroupsScreen({ tripId }: { tripId: string }) {
  const { detail, error, refetch, isRefetching } = useTripDetail(tripId);
  const save = useSetMyGroups(tripId);
  const [picked, setPicked] = useState<string[] | null>(null);
  const selected = picked ?? detail?.me.groupIds ?? [];

  return (
    <Screen grouped>
      {error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !detail && <Loading />}
      {detail?.trip.revealed && <Footnote>Este evento ya se reveló.</Footnote>}
      {detail && !detail.trip.revealed && (
        <>
          <PickGroups
            groups={detail.trip.groups}
            selected={selected}
            onChange={(ids) => {
              save.reset();
              setPicked(ids);
            }}
          />
          <Button
            label="Guardar"
            disabled={selected.length === 0}
            loading={save.isPending}
            onPress={() => save.mutate(selected, { onSuccess: () => router.back() })}
          />
        </>
      )}
      {save.error && <ErrorText>{errorMessage(save.error, "No se pudieron guardar los grupos")}</ErrorText>}
    </Screen>
  );
}
