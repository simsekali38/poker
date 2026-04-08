import { Vote, VoteCard } from '@app/core/models';
import { isNumericVoteCard } from '@app/shared/utils/voting.utils';

export interface ConsensusNumericResult {
  readonly available: boolean;
  readonly card: VoteCard | null;
  /** Shown when `available` is false (moderator-facing). */
  readonly unavailableReason: string;
}

/**
 * Consensus = all revealed numeric votes are the same card value.
 * Non-numeric special cards are ignored; if there are no numeric votes, consensus is unavailable.
 */
export function consensusNumericVote(votes: readonly Vote[]): ConsensusNumericResult {
  const numericCards = votes.map((v) => v.selectedCard).filter(isNumericVoteCard);
  if (numericCards.length === 0) {
    return {
      available: false,
      card: null,
      unavailableReason: 'No numeric votes — consensus applies only to matching numeric cards.',
    };
  }
  const first = numericCards[0]!;
  const allSame = numericCards.every((c) => c === first);
  if (!allSame) {
    return {
      available: false,
      card: null,
      unavailableReason: 'Numeric votes differ — pick an average or a card manually.',
    };
  }
  return { available: true, card: first, unavailableReason: '' };
}

/** Numeric planning cards from the deck, in deck order (for moderator pick). */
export function numericCardsFromDeckOrdered(deck: readonly VoteCard[]): VoteCard[] {
  return deck.filter(isNumericVoteCard);
}

/**
 * Round `rawAverage` **up** to the next numeric deck card: the smallest deck value ≥ average
 * (ceiling onto the deck). If the average is above every card, returns the deck maximum.
 */
export function roundAverageToNearestDeckCard(
  rawAverage: number,
  deck: readonly VoteCard[],
): VoteCard | null {
  const numericCards = numericCardsFromDeckOrdered(deck);
  if (numericCards.length === 0) {
    return null;
  }
  let ceilCard: VoteCard | null = null;
  let ceilVal = Number.POSITIVE_INFINITY;
  for (const card of numericCards) {
    const v = Number(card);
    if (v >= rawAverage && v < ceilVal) {
      ceilVal = v;
      ceilCard = card;
    }
  }
  if (ceilCard !== null) {
    return ceilCard;
  }
  let maxCard = numericCards[0]!;
  let maxVal = Number(maxCard);
  for (const card of numericCards) {
    const v = Number(card);
    if (v > maxVal) {
      maxVal = v;
      maxCard = card;
    }
  }
  return maxCard;
}
