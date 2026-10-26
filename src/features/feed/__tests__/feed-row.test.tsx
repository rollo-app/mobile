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
  authorAvatarUrl: null,
  pending: false,
  ...over,
});

describe("FeedRow", () => {
  it("shows the initial, the name with the trip time and 'sacó una foto' if there is no caption", async () => {
    await render(<FeedRow item={item()} timeZone={TZ} />);

    expect(screen.getByText("C", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("Cami")).toBeTruthy();
    expect(screen.getByText("14:32")).toBeTruthy();
    expect(screen.getByText("sacó una foto")).toBeTruthy();
  });

  it("for a video without a caption it shows how long it lasts", async () => {
    await render(<FeedRow item={item({ type: "video", durationS: 12.2 })} timeZone={TZ} />);
    expect(screen.getByText("sacó un video · 12 s")).toBeTruthy();
  });

  it("with a caption, the caption is the main text and the generic text does not appear", async () => {
    await render(<FeedRow item={item({ caption: "el viento no perdona" })} timeZone={TZ} />);

    expect(screen.getByText("el viento no perdona")).toBeTruthy();
    expect(screen.queryByText("sacó una foto")).toBeNull();
  });

  it("shows the blurry thumbhash, or a gray fill if there is none", async () => {
    const { rerender } = await render(<FeedRow item={item()} timeZone={TZ} />);
    expect(screen.getByTestId("feed-thumb")).toBeTruthy();

    await rerender(<FeedRow item={item({ thumbhash: null })} timeZone={TZ} />);
    expect(screen.getByTestId("feed-thumb-empty")).toBeTruthy();
  });

  it("tapping the avatar or the name calls onAuthorPress, not onPress", async () => {
    const onPress = jest.fn();
    const onAuthorPress = jest.fn();
    await render(<FeedRow item={item()} timeZone={TZ} onPress={onPress} onAuthorPress={onAuthorPress} />);

    await fireEvent.press(screen.getByRole("button", { name: "Perfil de Cami" }));
    await fireEvent.press(screen.getByText("Cami"));
    expect(onAuthorPress).toHaveBeenCalledTimes(2);
    expect(onAuthorPress).toHaveBeenCalledWith(expect.objectContaining({ id: "f1" }));
    expect(onPress).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("sacó una foto"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("VoiceOver can open the author's profile from the row", async () => {
    const onAuthorPress = jest.fn();
    await render(<FeedRow item={item()} timeZone={TZ} onPress={jest.fn()} onAuthorPress={onAuthorPress} />);

    const row = screen.getByRole("button", { name: "Cami, 14:32" });
    expect(row.props.accessibilityActions).toEqual([{ name: "profile", label: "Ver perfil de Cami" }]);
    await fireEvent(row, "accessibilityAction", { nativeEvent: { actionName: "profile" } });
    expect(onAuthorPress).toHaveBeenCalledTimes(1);
  });

  it("a moment with files shows the real photo with the moment badge instead of the thumbhash", async () => {
    const moment = item({ momentDay: "2027-01-12", thumbPath: "/media/f1/thumb" });
    await render(<FeedRow item={moment} timeZone={TZ} token="tok" />);

    const thumb = screen.getByTestId("feed-thumb");
    expect(thumb.props.source).toEqual([{ uri: expect.stringContaining("/media/f1/thumb"), headers: { Authorization: "Bearer tok" } }]);
    expect(screen.getByTestId("moment-badge")).toBeTruthy();
  });

  it("an ordinary row has no badge and keeps the thumbhash", async () => {
    await render(<FeedRow item={item({ thumbPath: "/media/f1/thumb" })} timeZone={TZ} token="tok" />);

    expect(screen.queryByTestId("moment-badge")).toBeNull();
    expect(screen.getByTestId("feed-thumb").props.source).toEqual([]);
  });

  it("tapping a visible moment opens the photo, not the map", async () => {
    const onPress = jest.fn();
    const onOpenPhoto = jest.fn();
    const moment = item({ momentDay: "2027-01-12", thumbPath: "/media/f1/thumb" });
    await render(<FeedRow item={moment} timeZone={TZ} token="tok" onPress={onPress} onOpenPhoto={onOpenPhoto} />);

    await fireEvent.press(screen.getByRole("button", { name: /^Cami, / }));

    expect(onOpenPhoto).toHaveBeenCalledWith(expect.objectContaining({ id: "f1" }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("a visible moment without a location is still tappable", async () => {
    const onOpenPhoto = jest.fn();
    const moment = item({ momentDay: "2027-01-12", thumbPath: "/media/f1/thumb", lat: null, lng: null });
    await render(<FeedRow item={moment} timeZone={TZ} token="tok" onOpenPhoto={onOpenPhoto} />);

    await fireEvent.press(screen.getByRole("button", { name: /^Cami, / }));
    expect(onOpenPhoto).toHaveBeenCalledTimes(1);
  });

  it("a pending photo says 'Esperando señal'", async () => {
    await render(<FeedRow item={item({ pending: true })} timeZone={TZ} />);
    expect(screen.getByText("Esperando señal")).toBeTruthy();
  });

  it("tapping a row with a location reports the item", async () => {
    const onPress = jest.fn();
    await render(<FeedRow item={item()} timeZone={TZ} onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button", { name: /^Cami, / }));

    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: "f1" }));
  });

  it("without a location the row is not tappable and shows no place", async () => {
    await render(<FeedRow item={item({ lat: null, lng: null })} timeZone={TZ} onPress={jest.fn()} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("the admin long-presses the row: haptic, action sheet and, if they pick Borrar foto, reports the item", async () => {
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

  it("if they cancel the action sheet nothing happens", async () => {
    const onDelete = jest.fn();
    await render(<FeedRow item={item()} timeZone={TZ} onDelete={onDelete} />);
    await fireEvent(screen.getByLabelText(/^Cami, /), "longPress");

    sheet.mock.calls[0]![1](1);

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("without onDelete (non-admin) or with a pending photo there is no long press", async () => {
    const { rerender } = await render(<FeedRow item={item()} timeZone={TZ} onPress={jest.fn()} />);
    expect(screen.getByLabelText(/^Cami, /).props.onLongPress).toBeUndefined();

    await rerender(<FeedRow item={item({ pending: true })} timeZone={TZ} onPress={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByLabelText(/^Cami, /).props.onLongPress).toBeUndefined();
  });

  describe("the thumbnail always stays in the right-hand column", () => {
    const stretch = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never)?.alignSelf;

    const variants: [string, Partial<React.ComponentProps<typeof FeedRow>>][] = [
      ["tappable", { onPress: jest.fn() }],
      ["not tappable", {}],
      ["with admin menu", { onPress: jest.fn(), onDelete: jest.fn() }],
    ];

    it.each(variants)("%s row: full-width wrappers and the thumbnail last, fixed width", async (_name, props) => {
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
