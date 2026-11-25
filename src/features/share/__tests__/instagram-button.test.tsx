import { render, screen } from "@testing-library/react-native";
import { InstagramButton } from "../instagram-button";

describe("InstagramButton", () => {
  it("puts the logo on a white tile in the primary variant", async () => {
    await render(<InstagramButton onPress={() => {}} />);
    expect(screen.getByTestId("instagram-logo-tile")).toBeTruthy();
    expect(screen.getByTestId("instagram-logo")).toBeTruthy();
  });

  it("keeps the bare logo in the secondary variant", async () => {
    await render(<InstagramButton onPress={() => {}} variant="secondary" />);
    expect(screen.queryByTestId("instagram-logo-tile")).toBeNull();
    expect(screen.getByTestId("instagram-logo")).toBeTruthy();
  });
});
