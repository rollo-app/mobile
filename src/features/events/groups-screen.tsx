import { SymbolView } from "expo-symbols";
import { Alert, Pressable } from "react-native";
import { errorMessage } from "@/api/client";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Footnote, Loading, Row, Screen, Section } from "@/ui/components";
import { colors } from "@/ui/theme";
import { useGroupMutations } from "./use-group-mutations";

export const MAX_GROUP_NAME = 40;

/** "Grupos" for organizers: add, rename (tap a group) and delete the groups of the event. Server errors (409) show inline. */
export function GroupsScreen({ tripId }: { tripId: string }) {
  const { detail, error, refetch, isRefetching } = useTripDetail(tripId);
  const { create, rename, remove } = useGroupMutations(tripId);
  const failure = errorMessage(create.error ?? rename.error ?? remove.error, "No se pudo guardar el grupo");

  const clearErrors = () => {
    create.reset();
    rename.reset();
    remove.reset();
  };
  const prompt = (title: string, initial: string | undefined, onSave: (name: string) => void) =>
    Alert.prompt(
      title,
      undefined,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Guardar",
          onPress: (text?: string) => {
            const name = (text ?? "").trim();
            if (name.length === 0 || name === initial) return;
            clearErrors();
            onSave(name.slice(0, MAX_GROUP_NAME));
          },
        },
      ],
      "plain-text",
      initial,
    );
  const confirmDelete = (group: { id: string; name: string }) =>
    Alert.alert(`¿Borrar "${group.name}"?`, undefined, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => {
          clearErrors();
          remove.mutate(group.id);
        },
      },
    ]);

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
          <Section footer="Tocá un grupo para cambiarle el nombre.">
            {detail.trip.groups.map((group) => (
              <Row
                key={group.id}
                label={group.name}
                chevron={false}
                onPress={() => prompt("Nombre del grupo", group.name, (name) => rename.mutate({ groupId: group.id, name }))}
                accessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Borrar ${group.name}`}
                    hitSlop={8}
                    onPress={() => confirmDelete(group)}
                  >
                    <SymbolView name="trash" size={18} tintColor={colors.danger as string} />
                  </Pressable>
                }
              />
            ))}
          </Section>
          <Section>
            <Row label="Agregar grupo" chevron={false} loading={create.isPending} onPress={() => prompt("Nuevo grupo", undefined, (name) => create.mutate(name))} />
          </Section>
        </>
      )}
      {failure && <ErrorText>{failure}</ErrorText>}
    </Screen>
  );
}
