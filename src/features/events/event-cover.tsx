import { Image } from "expo-image";
import { StyleSheet } from "react-native";
import type { TripDetail } from "@/features/trips/actions";
import { API_URL } from "@/config";
import { ErrorText, Row, Section } from "@/ui/components";
import { radius } from "@/ui/theme";
import { isOrganizer } from "./event";
import { useUploadCover } from "./use-upload-cover";

/** The event's cover; organizers can choose or change it until the reveal. */
export function EventCover({ detail }: { detail: TripDetail }) {
  const { coverUrl, revealed, id } = detail.trip;
  const cover = useUploadCover(id);
  const canEdit = isOrganizer(detail) && !revealed;
  if (!coverUrl && !canEdit) return null;
  return (
    <>
      <Section>
        {coverUrl && <Image source={{ uri: `${API_URL}${coverUrl}` }} style={styles.cover} contentFit="cover" accessibilityIgnoresInvertColors />}
        {canEdit && (
          <Row label={coverUrl ? "Cambiar portada" : "Elegir portada"} loading={cover.uploading} onPress={cover.uploading ? undefined : () => void cover.pick()} />
        )}
      </Section>
      {cover.error && <ErrorText>{cover.error}</ErrorText>}
    </>
  );
}

const styles = StyleSheet.create({
  cover: { width: "100%", aspectRatio: 16 / 9, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
});
