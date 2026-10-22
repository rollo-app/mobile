import { tripSummary } from "@/test/account";
import { addableTrips } from "../addable-trips";

const common = (id: string) => ({ id, name: id, startsAt: 0, endsAt: 1, revealed: false });

describe("addableTrips", () => {
  it("keeps your unrevealed trips that aren't in common, in your order", () => {
    const mine = [tripSummary("t3", "C"), tripSummary("t1", "A"), tripSummary("t2", "B")];

    expect(addableTrips(mine, [common("t1")]).map((t) => t.id)).toEqual(["t3", "t2"]);
  });

  it("leaves out revealed trips", () => {
    const mine = [tripSummary("t1", "A", { revealed: true }), tripSummary("t2", "B")];

    expect(addableTrips(mine, []).map((t) => t.id)).toEqual(["t2"]);
  });

  it("is empty when everything is shared or revealed", () => {
    expect(addableTrips([tripSummary("t1", "A")], [common("t1")])).toEqual([]);
  });
});
