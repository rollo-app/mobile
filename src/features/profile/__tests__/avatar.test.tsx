import { render, screen } from "@testing-library/react-native";
import { Avatar } from "../avatar";

const hidden = { includeHiddenElements: true };

describe("Avatar", () => {
  it("shows the initial when there's no photo", async () => {
    await render(<Avatar id="u1" name="juani" />);
    expect(screen.getByText("J", hidden)).toBeTruthy();
    expect(screen.queryByTestId("avatar-image", hidden)).toBeNull();
  });

  it("layers the photo over the initial when there is one", async () => {
    await render(<Avatar id="u1" name="Juani" avatarUrl="/avatars/u1/a.jpg" />);
    expect(screen.getByTestId("avatar-image", hidden)).toBeTruthy();
    expect(screen.getByText("J", hidden)).toBeTruthy();
  });

  it("shows the local photo while it uploads, even without a server one", async () => {
    await render(<Avatar id="u1" name="Juani" localUri="file:///cache/new.jpg" />);
    expect(screen.getByTestId("avatar-image", hidden)).toBeTruthy();
  });

  it("uses the size it's given", async () => {
    await render(<Avatar id="u1" name="Juani" size={72} />);
    expect(screen.getByTestId("avatar", hidden)).toHaveStyle({ width: 72, height: 72, borderRadius: 36 });
  });
});
