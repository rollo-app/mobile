import { Stack } from "expo-router";
import { SHARE_ICON } from "@/ui/share-icon";

type Props = {
  selecting: boolean;
  allSelected: boolean;
  /** Every photo is loaded, so "select all" really is all (deselecting is always possible). */
  canSelectAll: boolean;
  busy: boolean;
  hasPhotos: boolean;
  canSaveAll: boolean;
  /** Groups to filter by; only given when you see more than one (an organizer, or a guest in several groups). */
  groups?: { id: string; name: string }[];
  groupId?: string | null;
  onToggleAll: () => void;
  onStopSelecting: () => void;
  onStartSelecting: () => void;
  onSelectGroup?: (id: string | null) => void;
  onSaveAll: () => void;
  /** "Compartir" (the roll's collage), shown while not selecting; the screen that owns the roll decides if it can. */
  onShare?: () => void;
};

/** Native header buttons: share, select, filter by group and "Guardar todo en Fotos". */
export function GalleryToolbar({
  selecting,
  allSelected,
  canSelectAll,
  busy,
  hasPhotos,
  canSaveAll,
  groups = [],
  groupId = null,
  onToggleAll,
  onStopSelecting,
  onStartSelecting,
  onSelectGroup,
  onSaveAll,
  onShare,
}: Props) {
  return (
    <>
      {selecting && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button disabled={!allSelected && !canSelectAll} onPress={onToggleAll}>
            {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      )}
      <Stack.Toolbar placement="right">
        {/* Direct children only: the header drops Fragments, which is how both buttons once vanished. */}
        {!selecting && !!onShare && <Stack.Toolbar.Button icon={SHARE_ICON} iconRenderingMode="template" accessibilityLabel="Compartir" onPress={onShare} />}
        {selecting && <Stack.Toolbar.Button onPress={onStopSelecting}>Cancelar</Stack.Toolbar.Button>}
        {!selecting && (
          <Stack.Toolbar.Button disabled={busy || !hasPhotos} onPress={onStartSelecting}>
            Seleccionar
          </Stack.Toolbar.Button>
        )}
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
