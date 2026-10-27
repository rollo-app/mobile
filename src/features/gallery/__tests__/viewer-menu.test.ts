import type { RevealedPhoto } from "@/features/media/revealed";
import { viewerMenu } from "../viewer-menu";

const photo = (over: Partial<RevealedPhoto> = {}) =>
  ({ id: "p1", type: "photo", authorUserId: "me", featureBlocked: false, momentDay: null, archived: false, ...over }) as RevealedPhoto;
const ids = (actions: { id?: string }[]) => actions.map((a) => a.id);

describe("viewerMenu", () => {
  it("is empty without a photo or an account", () => {
    expect(viewerMenu({ photo: undefined, meId: "me", revealed: true, blocking: false })).toEqual([]);
    expect(viewerMenu({ photo: photo(), meId: undefined, revealed: true, blocking: false })).toEqual([]);
  });

  it("only offers to report someone else's photo", () => {
    expect(ids(viewerMenu({ photo: photo({ authorUserId: "u2" }), meId: "me", revealed: true, blocking: false }))).toEqual(["report"]);
  });

  it("offers feature block, archive and delete on your revealed photo", () => {
    expect(ids(viewerMenu({ photo: photo(), meId: "me", revealed: true, blocking: false }))).toEqual(["block", "archive", "delete"]);
  });

  it("flips to unblock and unarchive", () => {
    const menu = viewerMenu({ photo: photo({ featureBlocked: true, archived: true }), meId: "me", revealed: true, blocking: false });
    expect(ids(menu)).toEqual(["unblock", "unarchive", "delete"]);
    expect(menu[0]).toMatchObject({ title: "Dejar que la destaquen" });
  });

  it("has no archive or delete before the reveal", () => {
    expect(ids(viewerMenu({ photo: photo(), meId: "me", revealed: false, blocking: false }))).toEqual(["block"]);
  });

  it("has no feature block on moments or videos", () => {
    expect(ids(viewerMenu({ photo: photo({ momentDay: "2027-01-12" }), meId: "me", revealed: true, blocking: false }))).toEqual(["archive", "delete"]);
    expect(ids(viewerMenu({ photo: photo({ type: "video" }), meId: "me", revealed: true, blocking: false }))).toEqual(["archive", "delete"]);
  });

  it("disables the block option while a change is in flight", () => {
    const menu = viewerMenu({ photo: photo(), meId: "me", revealed: false, blocking: true });
    expect(menu[0]).toMatchObject({ attributes: { disabled: true } });
  });
});
