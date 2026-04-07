import { Vote, VoteCard } from '@app/core/models';

const SPECIAL = new Set<VoteCard>(['?', 'coffee', 'abstain']);

/** TODO: extend when custom numeric decks differ from simple number strings. */
export function isNumericVoteCard(card: VoteCard): boolean {
  if (SPECIAL.has(card)) {
    return false;
  }
  if (card === 'xs' || card === 's' || card === 'm' || card === 'l' || card === 'xl') {
    return false;
  }
  return /^[0-9]+(\.[0-9]+)?$/.test(card);
}

/** Mean of numeric cards only; `null` if none. */
export function averageNumericVotes(votes: Vote[]): number | null {
  const nums = votes
    .map((v) => v.selectedCard)
    .filter((c) => isNumericVoteCard(c))
    .map((c) => Number(c));
  if (nums.length === 0) {
    return null;
  }
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
