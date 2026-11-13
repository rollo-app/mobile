import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import "@/test/reanimated";
import * as actions from "@/features/comments/actions";
import { signInAs } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/comments/actions");
// Each comment row renders one Avatar, so its renders count the row renders.
const mockAvatarRenders = jest.fn();
jest.mock("@/features/profile/avatar", () => ({
  Avatar: () => {
    mockAvatarRenders();
    return null;
  },
}));

const comments = jest.mocked(actions);

const comment = (id: string, text: string): actions.Comment => ({
  id,
  text,
  createdAt: Date.now() - 5 * 60_000,
  author: { userId: "u-m2", name: "Fede", username: null, avatarUrl: null },
  canDelete: true,
});

describe("Comments sheet rows", () => {
  it("does not re-render the rows while typing in the composer", async () => {
    comments.fetchComments.mockReset().mockResolvedValue([comment("c1", "uno"), comment("c2", "dos")]);
    await signInAs({});
    await renderRouter(routes, { initialUrl: "/comments/a" });
    await screen.findByText("dos");
    const rendersBefore = mockAvatarRenders.mock.calls.length;
    expect(rendersBefore).toBeGreaterThanOrEqual(2);

    const field = screen.getByLabelText("Escribí un comentario");
    await fireEvent.changeText(field, "h");
    await fireEvent.changeText(field, "ho");
    await fireEvent.changeText(field, "hol");

    expect(screen.getByLabelText("Escribí un comentario").props.value).toBe("hol");
    expect(mockAvatarRenders.mock.calls.length).toBe(rendersBefore);
  });
});
