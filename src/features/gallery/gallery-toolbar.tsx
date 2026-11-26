import { Stack } from "expo-router";
import { SHARE_ICON } from "@/ui/share-icon";

type Props = {
  selecting: boolean;
  canSaveAll: boolean;
  /** Groups to filter by; only given when you see more than one (an organizer, or a guest in several groups). */
  groups?: { id: string; name: string }[];
  groupId?: string | null;
  onStopSelecting: () => void;
  onSelectGroup?: (id: string | null) => void;
  onSaveAll: () => void;
  /** "Compartir" (the roll's collage), shown while not selecting; the screen that owns the roll decides if it can. */
  onShare?: () => void;
};

/** Native header buttons: share, filter by group and "Guardar todo en Fotos". */
export function GalleryToolbar({
  selecting,
  canSaveAll,
  groups = [],
  groupId = null,
  onStopSelecting,
  onSelectGroup,
  onSaveAll,
  onShare,
}: Props) {
  return (
    <>
      <Stack.Toolbar placement="right">
        {/* Direct children only: the header drops Fragments, which is how both buttons once vanished. */}
        {!selecting && !!onShare && <Stack.Toolbar.Button icon={SHARE_ICON} iconRenderingMode="template" accessibilityLabel="Compartir" onPress={onShare} />}
        {selecting && <Stack.Toolbar.Button icon="xmark" accessibilityLabel="Cancelar" onPress={onStopSelecting} />}
        {!selecting && (
          <Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="Más opciones">
            {groups.length > 0 && (
              <Stack.Toolbar.Menu title="Grupos" icon="person.3">
                <Stack.Toolbar.MenuAction isOn={groupId === null} onPress={() => onSelectGroup?.(null)}>
                  Todos
                </Stack.Toolbar.MenuAction>
                {groups.map((g) => (
                  <Stack.Toolbar.MenuAction key={g.id} isOn={groupId === g.id} onPress={() => onSelectGroup?.(g.id)}>
                    {g.name}
                  </Stack.Toolbar.MenuAction>
                ))}
              </Stack.Toolbar.Menu>
            )}
            <Stack.Toolbar.MenuAction icon="square.and.arrow.down" disabled={!canSaveAll} onPress={onSaveAll}>
              Guardar todo en Fotos
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        )}
      </Stack.Toolbar>
    </>
  );
}
