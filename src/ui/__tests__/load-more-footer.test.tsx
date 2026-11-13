import { fireEvent, render, screen } from "@testing-library/react-native";
import { LoadMoreFooter } from "../load-more-footer";

describe("LoadMoreFooter", () => {
  it("shows a spinner while loading more", async () => {
    await render(<LoadMoreFooter loading error={false} onRetry={jest.fn()} testID="more" />);
    expect(screen.getByTestId("more")).toBeTruthy();
    expect(screen.queryByText("Reintentar")).toBeNull();
  });

  it("shows the error with Reintentar, which retries", async () => {
    const onRetry = jest.fn();
    await render(<LoadMoreFooter loading={false} error onRetry={onRetry} />);
    expect(screen.getByText("No se pudieron cargar más fotos.")).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders nothing otherwise", async () => {
    await render(<LoadMoreFooter loading={false} error={false} onRetry={jest.fn()} />);
    expect(screen.toJSON()).toBeNull();
  });
});
