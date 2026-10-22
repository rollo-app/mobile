import { UploadStatusSection } from "@/features/capture/upload-status-section";
import { RollPeople } from "@/features/roll/roll-people";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Loading, Screen } from "@/ui/components";

/** "Sobre el rollo" (sheet): what the board shows below the dates, for a roll that is already revealed. */
export function RollInfo() {
  const { trip } = useActiveTrip();
  const { detail, error, refetch, isRefetching } = useTripDetail(trip?.id);

  return (
    <Screen grouped>
      {error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !detail && trip && <Loading />}
      {trip && detail && (
        <>
          <UploadStatusSection tripId={trip.id} timeZone={detail.trip.timezone} />
          <RollPeople detail={detail} inSheet />
        </>
      )}
    </Screen>
  );
}
