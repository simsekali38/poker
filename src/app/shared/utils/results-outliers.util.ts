import { VoteCard } from '@app/core/models';

function numericFromCard(card: VoteCard): number | null {
  const n = Number(card);
  return Number.isFinite(n) ? n : null;
}

/**
 * Members whose numeric vote falls outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR].
 * Empty when fewer than 3 numeric votes or IQR is 0.
 */
export function outlierMemberIds(rows: readonly { memberId: string; card: VoteCard }[]): Set<string> {
  const numeric = rows
    .map((r) => ({ memberId: r.memberId, v: numericFromCard(r.card) }))
    .filter((r): r is { memberId: string; v: number } => r.v !== null);
  if (numeric.length < 3) {
    return new Set();
  }
  const values = numeric.map((r) => r.v).sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = (values.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) {
      return values[lo];
    }
    return values[lo] + (values[hi] - values[lo]) * (idx - lo);
  };
  const q1 = q(0.25);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  if (iqr <= 0) {
    return new Set();
  }
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  const out = new Set<string>();
  for (const r of numeric) {
    if (r.v < low || r.v > high) {
      out.add(r.memberId);
    }
  }
  return out;
}
