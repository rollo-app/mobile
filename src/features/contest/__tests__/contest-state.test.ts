import type { Schemas } from "@/api/client";
import { canPick, cardCopy, countdownLabel, pickCountLabel, pickHint, progressStyle, SUGGESTED_FINALISTS, picksRowVisible, shuffledFinalists } from "../contest-state";

describe("pickHint", () => {
  it("only nudges past the suggested count", () => {
    expect(pickHint(15)).toBeNull();
    expect(pickHint(16)).toBe("te sugerimos hasta 15");
  });
});

describe("pickCountLabel", () => {
  it("counts the picks over the maximum", () => {
    expect(pickCountLabel(0)).toBe("0 elegidas");
    expect(pickCountLabel(1)).toBe("1 elegida");
    expect(pickCountLabel(4)).toBe("4 elegidas");
    expect(pickCountLabel(16)).toBe("16 elegidas");
    expect(SUGGESTED_FINALISTS).toBe(15);
  });
});

describe("canPick", () => {
  it("only an organizer while the finalists are being chosen", () => {
    expect(canPick({ status: "selecting" }, true)).toBe(true);
    expect(canPick({ status: "selecting" }, false)).toBe(false);
    for (const status of ["pending", "voting", "closing", "tied", "closed", "cancelled"] as const) {
      expect(canPick({ status }, true)).toBe(false);
    }
  });

  it("not without a contest", () => {
    expect(canPick(null, true)).toBe(false);
    expect(canPick(undefined, true)).toBe(false);
  });
});

describe("picksRowVisible", () => {
  const on = { organizer: true, contestEnabled: true, phase: "ended" as const };
  it("shows for an organizer of an event with a contest, ended and not revealed", () => {
    expect(picksRowVisible(on)).toBe(true);
  });
  it("hides for guests, without contest and in any other phase", () => {
    expect(picksRowVisible({ ...on, organizer: false })).toBe(false);
    expect(picksRowVisible({ ...on, contestEnabled: false })).toBe(false);
    expect(picksRowVisible({ ...on, phase: "active" })).toBe(false);
    expect(picksRowVisible({ ...on, phase: "upcoming" })).toBe(false);
    expect(picksRowVisible({ ...on, phase: "revealed" })).toBe(false);
    expect(picksRowVisible({ ...on, phase: null })).toBe(false);
  });
});

describe("countdownLabel", () => {
  const now = 1_000_000_000_000;
  const H = 3_600_000;
  it("counts in days, hours or minutes", () => {
    expect(countdownLabel(now + 2 * 24 * H + 5 * H, now)).toBe("Cierra en 2 días");
    expect(countdownLabel(now + 24 * H, now)).toBe("Cierra en 1 día");
    expect(countdownLabel(now + 5 * H + 20 * 60_000, now)).toBe("Cierra en 5 h");
    expect(countdownLabel(now + 12 * 60_000, now)).toBe("Cierra en 12 min");
  });
  it("never goes below a minute", () => {
    expect(countdownLabel(now + 5_000, now)).toBe("Cierra en 1 min");
    expect(countdownLabel(now - 5_000, now)).toBe("Cierra en 1 min");
  });
  it("is empty without a closing time", () => {
    expect(countdownLabel(null, now)).toBe("");
  });
});

describe("shuffledFinalists", () => {
  const list = (ids: string[]) => ids.map((mediaId) => ({ mediaId })) as Schemas["ContestFinalist"][];
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const order = (xs: Schemas["ContestFinalist"][]) => xs.map((f) => f.mediaId);

  it("same seed, same order, whatever order the server sends", () => {
    expect(order(shuffledFinalists(list(ids), "u1"))).toEqual(order(shuffledFinalists(list([...ids].reverse()), "u1")));
  });
  it("keeps every finalist and does not touch the input", () => {
    const input = list(ids);
    expect(order(shuffledFinalists(input, "u1")).sort()).toEqual(ids);
    expect(order(input)).toEqual(ids);
  });
  it("another seed gives another order", () => {
    const seen = new Set(["u1", "u2", "u3", "u4", "u5"].map((s) => order(shuffledFinalists(list(ids), s)).join("")));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("cardCopy", () => {
  const base: Schemas["Contest"] = { status: "voting", votingHours: 72, closesAt: 1_000_000 + 5 * 3_600_000, finalists: [], myVote: null, winner: null, tiedMediaIds: [] };
  it("by status", () => {
    expect(cardCopy(base, 1_000_000)).toBe("Concurso de fotos · Cierra en 5 h");
    expect(cardCopy({ ...base, status: "closing" }, 1_000_000)).toBe("Cerrando la votación…");
    expect(cardCopy({ ...base, status: "tied" }, 1_000_000)).toBe("Concurso de fotos · Hay un empate");
    expect(cardCopy({ ...base, status: "cancelled" }, 1_000_000)).toBe("El concurso se canceló.");
    expect(
      cardCopy({ ...base, status: "closed", winner: { mediaId: "m", author: { userId: "u", name: "Ana", username: null, avatarUrl: null }, imageAvailable: true } }, 1_000_000),
    ).toBe("Ganó la foto de Ana");
  });
  it("nothing before the voting or without a contest", () => {
    expect(cardCopy({ ...base, status: "pending" }, 1_000_000)).toBeNull();
    expect(cardCopy({ ...base, status: "selecting" }, 1_000_000)).toBeNull();
    expect(cardCopy({ ...base, status: "closed" }, 1_000_000)).toBeNull();
    expect(cardCopy(null, 1_000_000)).toBeNull();
  });
});

describe("progressStyle", () => {
  it("segments up to 20 finalists, a bar past that", () => {
    expect(progressStyle(1)).toBe("segments");
    expect(progressStyle(20)).toBe("segments");
    expect(progressStyle(21)).toBe("bar");
  });
});
