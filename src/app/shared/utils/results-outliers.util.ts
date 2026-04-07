import { VoteCard } from '@app/core/models';

function numericFromCard(card: VoteCard): number | null {
  const n = Number(card);
  return Number.isFinite(n) ? n : null;
}

function cardKey(card: VoteCard): string {
  return String(card);
}

/**
 * Outliers = numeric votes whose **index in `deckOrder`** is at least `minStepsFromMedian`
 * away from the **median index** (among numeric votes only). Non-numeric cards are ignored.
 *
 * Example: deck [1,2,3,5,8,13], votes 3,5,13 → median index ~2 (value 5). Value 13 is several steps away → outlier.
 */
export function outlierMemberIdsByMedianDeckDistance(
  rows: readonly { memberId: string; card: VoteCard }[],
  deckOrder: readonly VoteCard[],
  minStepsFromMedian = 2,
): Set<string> {
  const indexed: { memberId: string; deckIndex: number }[] = [];
  for (const r of rows) {
    const n = numericFromCard(r.card);
    if (n === null) {
      continue;
    }
    const key = cardKey(r.card);
    const deckIndex = deckOrder.findIndex((c) => cardKey(c) === key);
    if (deckIndex < 0) {
      continue;
    }
    indexed.push({ memberId: r.memberId, deckIndex });
  }
  if (indexed.length === 0) {
    return new Set();
  }
  const sorted = [...indexed].sort((a, b) => a.deckIndex - b.deckIndex);
  const mid = Math.floor(sorted.length / 2);
  let medianDeckIndex: number;
  if (sorted.length % 2 === 1) {
    medianDeckIndex = sorted[mid].deckIndex;
  } else {
    medianDeckIndex = Math.round((sorted[mid - 1].deckIndex + sorted[mid].deckIndex) / 2);
  }
  const out = new Set<string>();
  for (const r of indexed) {
    if (Math.abs(r.deckIndex - medianDeckIndex) >= minStepsFromMedian) {
      out.add(r.memberId);
    }
  }
  return out;
}
