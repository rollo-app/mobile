import { Stack } from "expo-router";

type Props = {
  selecting: boolean;
  allSelected: boolean;
  /** Every photo is loaded, so "select all" really is all (deselecting is always possible). */
  canSelectAll: boolean;
  busy: boolean;
  hasPhotos: boolean;
  canSaveAll: boolean;
  authors: { id: string; name: string }[];
  authorId: string | null;
  /** Groups to filter by; only given when you see more than one (an organizer, or a guest in several groups). */
  groups?: { id: string; name: string }[];
  groupId?: string | null;
  onToggleAll: () => void;
  onStopSelecting: () => void;
  onStartSelecting: () => void;
  onSelectAuthor: (id: string | null) => void;
  onSelectGroup?: (id: string | null) => void;
  onSaveAll: () => void;
};

/** Native header buttons: select, filter by person and "Guardar todo en Fotos". */
export function GalleryToolbar({
  selecting,
  allSelected,
  canSelectAll,
  busy,
  hasPhotos,
  canSaveAll,
  authors,
  authorId,
  groups = [],
  groupId = null,
  onToggleAll,
  onStopSelecting,
  onStartSelecting,
  onSelectAuthor,
  onSelectGroup,
  onSaveAll,
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
        {selecting && <Stack.Toolbar.Button onPress={onStopSelecting}>Cancelar</Stack.Toolbar.Button>}
        {!selecting && (
          <Stack.Toolbar.Button disabled={busy || !hasPhotos} onPress={onStartSelecting}>
            Seleccionar
          </Stack.Toolbar.Button>
        )}
        {!selecting && (
          <Stack.Toolbar.Menu icon="ellipsis.circle" accessibilityLabel="Más opciones">
            <Stack.Toolbar.Menu title="Filtrar por persona" icon="person.2">
              <Stack.Toolbar.MenuAction isOn={authorId === null} onPress={() => onSelectAuthor(null)}>
                Todos
              </Stack.Toolbar.MenuAction>
              {authors.map((a) => (
                <Stack.Toolbar.MenuAction key={a.id} isOn={authorId === a.id} onPress={() => onSelectAuthor(a.id)}>
                  {a.name}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
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
