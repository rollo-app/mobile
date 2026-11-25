import { render, screen } from "@testing-library/react-native";
import { InstagramButton } from "../instagram-button";

const WHITE = require("../../../../assets/share/instagram-white.png");
const COLOR = require("../../../../assets/share/instagram.png");

describe("InstagramButton", () => {
  it("shows the solid white glyph, no tile, in the primary variant", async () => {
    await render(<InstagramButton onPress={() => {}} />);
    expect(screen.getByTestId("instagram-logo").props.source).toBe(WHITE);
    expect(screen.queryByTestId("instagram-logo-tile")).toBeNull();
  });

  it("keeps the color glyph in the secondary variant", async () => {
    await render(<InstagramButton onPress={() => {}} variant="secondary" />);
    expect(screen.getByTestId("instagram-logo").props.source).toBe(COLOR);
    expect(screen.queryByTestId("instagram-logo-tile")).toBeNull();
  });
});
