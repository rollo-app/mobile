import { renderRouter, screen } from "expo-router/testing-library";
import { WORST_CASE_FIXTURES, WORST_CASE_STATES } from "@/features/profile/worst-case-fixtures";
import { signInAs } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");

describe("dev worst-case screen (profile header)", () => {
  beforeEach(async () => {
    await signInAs();
  });

  it.each(WORST_CASE_STATES)("renders the %s state without crashing", async (state) => {
    await renderRouter(routes, { initialUrl: `/dev/worst-case?state=${state}` });
    const avatars = await screen.findAllByTestId("avatar", { includeHiddenElements: true });
    expect(avatars).toHaveLength(WORST_CASE_FIXTURES[state].length);
  });

  it("falls back to the demo state for an unknown param", async () => {
    await renderRouter(routes, { initialUrl: "/dev/worst-case?state=nope" });
    expect(await screen.findAllByTestId("avatar", { includeHiddenElements: true })).toHaveLength(WORST_CASE_FIXTURES.demo.length);
  });
});
