import { Stack } from "expo-router";

type Props = {
  selecting: boolean;
  allSelected: boolean;
  busy: boolean;
  hasPhotos: boolean;
  canSaveAll: boolean;
  authors: { id: string; name: string }[];
  authorId: string | null;
  onToggleAll: () => void;
  onStopSelecting: () => void;
  onStartSelecting: () => void;
  onSelectAuthor: (id: string | null) => void;
  onSaveAll: () => void;
};

/** Native header buttons: select, filter by person and "Guardar todo en Fotos". */
export function GalleryToolbar({
  selecting,
  allSelected,
  busy,
  hasPhotos,
  canSaveAll,
  authors,
  authorId,
  onToggleAll,
  onStopSelecting,
  onStartSelecting,
  onSelectAuthor,
  onSaveAll,
}: Props) {
  return (
    <>
      {selecting && (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button onPress={onToggleAll}>
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
            <Stack.Toolbar.MenuAction icon="square.and.arrow.down" disabled={!canSaveAll} onPress={onSaveAll}>
              Guardar todo en Fotos
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        )}
      </Stack.Toolbar>
    </>
  );
}
