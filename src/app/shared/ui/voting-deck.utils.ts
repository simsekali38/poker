import { VotingCardState } from './voting-card.types';

export type VotingDeckPresentation = 'picker' | 'revealed';

/** Deck / vote values may be strings, numbers (legacy data), or trimmed differently — compare canonically. */
export function voteCardKeysEqual(a: unknown, b: unknown): boolean {
  const ka = normalizeVoteCardKey(a);
  const kb = normalizeVoteCardKey(b);
  if (ka === '' || kb === '') {
    return false;
  }
  if (ka === kb) {
    return true;
  }
  const na = Number(ka);
  const nb = Number(kb);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

function normalizeVoteCardKey(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).trim();
}

export function resolveVotingCardState(args: {
  cardValue: unknown;
  selectedValue: string | null | undefined;
  deckDisabled: boolean;
  presentation: VotingDeckPresentation;
}): VotingCardState {
  const rawSel =
    args.selectedValue != null ? normalizeVoteCardKey(args.selectedValue) : '';
  const selected = rawSel.length > 0 ? rawSel : null;
  const isSelected = selected !== null && voteCardKeysEqual(selected, args.cardValue);
  // Keep selected/revealed visuals even when the deck is locked (e.g. after reveal or while saving).
  // Interaction is handled separately via `interactionLocked` on the card button.
  if (args.presentation === 'revealed' && isSelected) {
    return 'revealed';
  }
  if (args.presentation === 'picker' && isSelected) {
    return 'selected';
  }
  if (args.deckDisabled) {
    return 'disabled';
  }
  return 'default';
}
