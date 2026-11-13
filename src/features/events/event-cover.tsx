import type { TripDetail } from "@/features/trips/actions";
import { ErrorText, Row, Section } from "@/ui/components";
import { isOrganizer } from "./event";
import { useUploadCover } from "./use-upload-cover";

/** Organizers choose or change the event's cover until the reveal (the photo itself is the board's hero, `EventHero`). */
export function EventCover({ detail }: { detail: TripDetail }) {
  const { coverUrl, revealed, id } = detail.trip;
  const cover = useUploadCover(id);
  if (!isOrganizer(detail) || revealed) return null;
  return (
    <>
      <Section>
        <Row label={coverUrl ? "Cambiar portada" : "Elegir portada"} loading={cover.uploading} onPress={cover.uploading ? undefined : () => void cover.pick()} />
      </Section>
      {cover.error && <ErrorText>{cover.error}</ErrorText>}
    </>
  );
}
