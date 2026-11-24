import type { ContestFinalist } from "./actions";

export type RankedFinalist = { finalist: ContestFinalist; place: number; share: number };

/**
 * Finalists by votes, most first. Ties share the place and the next one skips (9, 9, 6 → 1, 1, 3); ties keep a stable
 * order by `mediaId`. `share` is the votes over the top count (0 when nobody has votes). Hidden counts (`null`, while
 * `tied`) count as 0.
 */
export function rankFinalists(finalists: ContestFinalist[]): RankedFinalist[] {
  const votesOf = (f: ContestFinalist) => f.votes ?? 0;
  const sorted = [...finalists].sort((a, b) => votesOf(b) - votesOf(a) || (a.mediaId < b.mediaId ? -1 : a.mediaId > b.mediaId ? 1 : 0));
  const max = sorted.length ? votesOf(sorted[0]!) : 0;
  let place = 1;
  return sorted.map((finalist, index) => {
    if (index > 0 && votesOf(finalist) !== votesOf(sorted[index - 1]!)) place = index + 1;
    return { finalist, place, share: max > 0 ? votesOf(finalist) / max : 0 };
  });
}
