import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { fireEvent, renderRouter, screen, within } from "expo-router/testing-library";
import { ProfileHeader } from "../profile-header";

const base = { id: "u1", name: "Juani", username: "juani", avatarUrl: null, bio: null };
const show = (props: Partial<ComponentProps<typeof ProfileHeader>>) => renderRouter({ index: () => <ProfileHeader {...base} {...props} /> });

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

  it("shows the 0-friends line on your own profile and it is pressable", async () => {
    const onPress = jest.fn();
    await show({ friends: { count: 0, own: true, onPress } });
    await fireEvent.press(screen.getByRole("button", { name: "Todavía no tenés amigos" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("hides the 0-friends line on someone else's profile", async () => {
    await show({ friends: { count: 0, canSee: true, onPress: () => {} } });
    expect(screen.queryByText(/amigos/)).toBeNull();
  });

  it("puts the photo and the name column in one row, with the bio and friend count below it", async () => {
    await show({ bio: "Hola", friends: { count: 3, own: true, onPress: () => {} } });
    const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as { flexDirection?: string };
    const row = screen.getByTestId("profile-row");
    expect(flat(row).flexDirection).toBe("row");
    expect(within(row).getByTestId("avatar", { includeHiddenElements: true })).toBeTruthy();
    expect(within(row).getByTestId("profile-name")).toBeTruthy();
    expect(within(row).getByTestId("profile-username")).toBeTruthy();
    expect(within(row).queryByTestId("profile-bio")).toBeNull();
    expect(within(row).queryByText("3 amigos")).toBeNull();
    expect(screen.getByTestId("profile-bio")).toBeTruthy();
  });
});
