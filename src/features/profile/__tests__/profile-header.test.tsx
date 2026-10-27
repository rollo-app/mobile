import type { ComponentProps } from "react";
import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
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
});
