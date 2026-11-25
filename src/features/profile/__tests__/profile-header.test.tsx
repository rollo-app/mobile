import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { fireEvent, renderRouter, screen, within } from "expo-router/testing-library";
import { type } from "@/ui/theme";
import { ProfileHeader } from "../profile-header";

const base = { id: "u1", name: "Juani", username: "juani", avatarUrl: null, bio: null };
const show = (props: Partial<ComponentProps<typeof ProfileHeader>>) => renderRouter({ index: () => <ProfileHeader {...base} {...props} /> });
const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

describe("ProfileHeader", () => {
  it("lets a long name wrap up to 3 lines", async () => {
    await show({ name: "Aleksandra Wiśniewska-Kowalczy" });
    expect(screen.getByTestId("profile-name").props.numberOfLines).toBe(3);
  });

  it("keeps the @username on one line, truncated in the middle", async () => {
    await show({ username: "a_very.long_username_thirty_c1" });
    const handle = screen.getByTestId("profile-username");
    expect(handle.props.numberOfLines).toBe(1);
    expect(handle.props.ellipsizeMode).toBe("middle");
  });

  it.each([[""], ["   "]])("renders no name text for an empty name (%j)", async (name) => {
    await show({ name });
    expect(screen.queryByTestId("profile-name")).toBeNull();
  });

  it("centers the header", async () => {
    await show({});
    expect(flat(screen.getByTestId("profile-header")).alignItems).toBe("center");
    const avatar = screen.getByTestId("avatar", { includeHiddenElements: true });
    expect(flat(avatar)).toMatchObject({ width: 96, height: 96 });
    expect(flat(screen.getByTestId("profile-name"))).toMatchObject({ fontSize: 22, textAlign: "center" });
  });

  it("has no card: no background and no radius on the header", async () => {
    await show({ bio: "Hola" });
    const style = flat(screen.getByTestId("profile-header"));
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderRadius).toBeUndefined();
    expect(style.padding).toBeUndefined();
  });

  it("shows rolls, photos and friends in one line", async () => {
    await show({ stats: { rolls: 8, photos: 34, friends: 12, own: true, onPressFriends: () => {} } });
    expect(screen.getByTestId("profile-stats").props.accessibilityLabel).toBe("8 rollos, 34 fotos, 12 amigos");
  });

  it("opens the friend list from the whole line", async () => {
    const onPressFriends = jest.fn();
    await show({ stats: { rolls: 8, photos: 34, friends: 12, own: true, onPressFriends } });
    await fireEvent.press(screen.getByRole("button", { name: "8 rollos, 34 fotos, 12 amigos" }));
    expect(onPressFriends).toHaveBeenCalledTimes(1);
  });

  it("is not a button when there are no friends to open", async () => {
    await show({ stats: { rolls: 3, friends: 0, own: true, onPressFriends: () => {} } });
    expect(screen.getByTestId("profile-stats").props.accessibilityLabel).toBe("3 rollos");
    expect(screen.queryByRole("button", { name: "3 rollos" })).toBeNull();
    expect(screen.getByTestId("profile-stats").props.accessibilityState?.disabled).not.toBe(true);
  });

  it("shows the 0-friends line on your own empty profile and it is pressable", async () => {
    const onPressFriends = jest.fn();
    await show({ stats: { rolls: 0, photos: 0, friends: 0, own: true, onPressFriends } });
    await fireEvent.press(screen.getByRole("button", { name: "Todavía no tenés amigos" }));
    expect(onPressFriends).toHaveBeenCalledTimes(1);
  });

  it("shows no line on someone else's empty profile", async () => {
    await show({ stats: { friends: 0, canSee: true, onPressFriends: () => {} } });
    expect(screen.queryByTestId("profile-stats")).toBeNull();
  });

  it("shows no line without stats", async () => {
    await show({});
    expect(screen.queryByTestId("profile-stats")).toBeNull();
  });

  it("puts mutual friends on their own line", async () => {
    const onPressFriends = jest.fn();
    await show({ stats: { rolls: 5, photos: 21, friends: 48, mutual: 3, onPressFriends } });
    const mutual = screen.getByTestId("profile-mutual");
    expect(within(mutual).getByText("3 amigos en común")).toBeTruthy();
    await fireEvent.press(mutual);
    expect(onPressFriends).toHaveBeenCalledTimes(1);
  });

  it("wraps the handle row", async () => {
    await show({ badge: "founder" });
    const row = screen.getByTestId("profile-handle-row");
    expect(flat(row)).toMatchObject({ flexWrap: "wrap", justifyContent: "center", alignItems: "center" });
    expect(within(row).getByTestId("profile-username")).toBeTruthy();
    expect(within(row).getByLabelText(/^Insignia:/)).toBeTruthy();
  });

  it("sets the bio in the system serif", async () => {
    await show({ bio: "Hola" });
    expect(flat(screen.getByTestId("profile-bio"))).toMatchObject({ fontFamily: type.quote.fontFamily, textAlign: "center", fontSize: type.body.fontSize });
  });
});
