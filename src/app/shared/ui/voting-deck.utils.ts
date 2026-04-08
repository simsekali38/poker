import { VotingCardState } from './voting-card.types';

export type VotingDeckPresentation = 'picker' | 'revealed';

export function resolveVotingCardState(args: {
  cardValue: string;
  selectedValue: string | null;
  deckDisabled: boolean;
  presentation: VotingDeckPresentation;
}): VotingCardState {
  const isSelected = args.selectedValue !== null && args.selectedValue === args.cardValue;
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
