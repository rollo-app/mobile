import { Alert } from "react-native";
import type { TripDetail } from "@/features/trips/actions";
import { ErrorText, Footnote, Section, SwitchRow } from "@/ui/components";
import { useMyRolloFeaturing, useRolloPrivate } from "./use-featuring-levels";

export const PRIVATE_ROLLO_NOTE = "Ninguna foto de este rollo sale a perfiles, ni las tuyas.";

/**
 * Where your photos of this rollo can go (the rollo-level switches): your own "Tus fotos en otros perfiles" and,
 * for the admin, "Rollo privado". A private rollo has no photos on any profile, so the first one hides.
 */
export function FeaturingSection({ detail }: { detail: TripDetail }) {
  const tripId = detail.trip.id;
  const isPrivate = detail.trip.featuringDisabled;
  const mine = useMyRolloFeaturing(tripId, detail.me.allowFeaturing ?? true);
  const rolloPrivate = useRolloPrivate(tripId, isPrivate);
  const admin = detail.me.role === "admin";

  function setPrivate(next: boolean) {
    if (!next) return rolloPrivate.set(false);
    Alert.alert(
      "¿Hacer el rollo privado?",
      "Se sacan de todos los perfiles las fotos de este rollo, también las de quien las sacó. Si después lo desactivás, no vuelven solas.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Hacer privado", style: "destructive", onPress: () => rolloPrivate.set(true) },
      ],
    );
  }

  return (
    <>
      {!rolloPrivate.value && (
        <>
          <Section footer="Si lo apagás, nadie puede agregar a su perfil las fotos que sacás en este rollo. Las que ya estaban en un perfil se sacan.">
            <SwitchRow label="Tus fotos en otros perfiles" value={mine.value} onValueChange={mine.set} />
          </Section>
          {mine.error && <ErrorText>{mine.error}</ErrorText>}
        </>
      )}
      {admin ? (
        <>
          <Section footer={PRIVATE_ROLLO_NOTE}>
            <SwitchRow label="Rollo privado" value={rolloPrivate.value} onValueChange={setPrivate} />
          </Section>
          {rolloPrivate.error && <ErrorText>{rolloPrivate.error}</ErrorText>}
        </>
      ) : (
        isPrivate && <Footnote>{PRIVATE_ROLLO_NOTE}</Footnote>
      )}
    </>
  );
}
