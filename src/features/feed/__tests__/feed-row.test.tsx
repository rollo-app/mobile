import * as Haptics from "expo-haptics";
import { ActionSheetIOS, StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { MapItem } from "@/features/map/features";
import { FeedRow } from "../feed-row";

jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" } }));
const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation(() => {});
beforeEach(() => sheet.mockClear());

const TZ = "America/Argentina/Buenos_Aires";

const item = (over: Partial<MapItem> = {}): MapItem => ({
  id: "f1",
  type: "photo",
  takenAt: Date.parse("2027-01-12T17:32:00Z"),
  day: "2027-01-12",
  lat: -49.33,
  lng: -72.89,
  caption: null,
  durationS: null,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  authorId: "m2",
  authorName: "Cami",
  pending: false,
  ...over,
});

describe("FeedRow", () => {
  it("muestra la inicial, el nombre con la hora del viaje y 'sacó una foto' si no hay caption", async () => {
    await render(<FeedRow item={item()} timeZone={TZ} />);

    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.getByText("Cami")).toBeTruthy();
    expect(screen.getByText("14:32")).toBeTruthy();
    expect(screen.getByText("sacó una foto")).toBeTruthy();
  });

  it("para un video sin caption dice cuánto dura", async () => {
    await render(<FeedRow item={item({ type: "video", durationS: 12.2 })} timeZone={TZ} />);
    expect(screen.getByText("sacó un video · 12 s")).toBeTruthy();
  });

  it("con caption, el caption es lo principal y no aparece el texto genérico", async () => {
    await render(<FeedRow item={item({ caption: "el viento no perdona" })} timeZone={TZ} />);

    expect(screen.getByText("el viento no perdona")).toBeTruthy();
    expect(screen.queryByText("sacó una foto")).toBeNull();
  });

  it("muestra el thumbhash borroso, o un relleno gris si no hay", async () => {
    const { rerender } = await render(<FeedRow item={item()} timeZone={TZ} />);
    expect(screen.getByTestId("feed-thumb")).toBeTruthy();

    await rerender(<FeedRow item={item({ thumbhash: null })} timeZone={TZ} />);
    expect(screen.getByTestId("feed-thumb-empty")).toBeTruthy();
  });

  it("una foto pendiente dice 'Esperando señal'", async () => {
    await render(<FeedRow item={item({ pending: true })} timeZone={TZ} />);
    expect(screen.getByText("Esperando señal")).toBeTruthy();
  });

  it("tocar una fila con ubicación avisa con el item", async () => {
    const onPress = jest.fn();
    await render(<FeedRow item={item()} timeZone={TZ} onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button", { name: /^Cami, / }));

    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: "f1" }));
  });

  it("sin ubicación la fila no es tocable ni muestra lugar", async () => {
    await render(<FeedRow item={item({ lat: null, lng: null })} timeZone={TZ} onPress={jest.fn()} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("el admin mantiene apretada la fila: haptic, action sheet y, si elige Borrar foto, avisa con el item", async () => {
    const onDelete = jest.fn();
    await render(<FeedRow item={item()} timeZone={TZ} onDelete={onDelete} />);

    await fireEvent(screen.getByLabelText(/^Cami, /), "longPress");

    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({ options: ["Borrar foto", "Cancelar"], destructiveButtonIndex: 0, cancelButtonIndex: 1 }),
      expect.any(Function),
    );
    expect(onDelete).not.toHaveBeenCalled();
    sheet.mock.calls[0]![1](0);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "f1" }));
  });

  it("si cancela la action sheet no pasa nada", async () => {
    const onDelete = jest.fn();
    await render(<FeedRow item={item()} timeZone={TZ} onDelete={onDelete} />);
    await fireEvent(screen.getByLabelText(/^Cami, /), "longPress");

    sheet.mock.calls[0]![1](1);

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("sin onDelete (no admin) o con la foto pendiente no hay long press", async () => {
    const { rerender } = await render(<FeedRow item={item()} timeZone={TZ} onPress={jest.fn()} />);
    expect(screen.getByLabelText(/^Cami, /).props.onLongPress).toBeUndefined();

    await rerender(<FeedRow item={item({ pending: true })} timeZone={TZ} onPress={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByLabelText(/^Cami, /).props.onLongPress).toBeUndefined();
  });

  describe("la miniatura queda siempre en la columna de la derecha", () => {
    const stretch = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never)?.alignSelf;

    const variants: [string, Partial<React.ComponentProps<typeof FeedRow>>][] = [
      ["tocable", { onPress: jest.fn() }],
      ["no tocable", {}],
      ["con menú de admin", { onPress: jest.fn(), onDelete: jest.fn() }],
    ];

    it.each(variants)("fila %s: envoltorios a todo el ancho y miniatura última, de ancho fijo", async (_name, props) => {
      await render(<FeedRow item={item({ caption: "ibai con netflix" })} timeZone={TZ} {...props} />);

      const row = screen.getByTestId("feed-row");
      expect(stretch(row)).toBe("stretch");
      for (let node = row.parent; node && node.parent && (node.type as unknown) !== undefined; node = node.parent) {
        if (typeof node.type === "string" && node.props.style !== undefined) expect(stretch(node)).toBe("stretch");
        if (node === screen.root) break;
      }
      const children = row.children as { props: { testID?: string } }[];
      const thumb = children[children.length - 1]!;
      expect(thumb.props.testID).toBe("feed-thumb");
      expect(StyleSheet.flatten((thumb.props as { style?: never }).style)?.flexShrink).toBe(0);
    });
  });
});
