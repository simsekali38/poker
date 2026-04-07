import { VotingCardState } from './voting-card.types';

export type VotingDeckPresentation = 'picker' | 'revealed';

export function resolveVotingCardState(args: {
  cardValue: string;
  selectedValue: string | null;
  deckDisabled: boolean;
  presentation: VotingDeckPresentation;
}): VotingCardState {
  if (args.deckDisabled) {
    return 'disabled';
  }
  const isSelected = args.selectedValue !== null && args.selectedValue === args.cardValue;
  if (args.presentation === 'revealed' && isSelected) {
    return 'revealed';
  }
  if (args.presentation === 'picker' && isSelected) {
    return 'selected';
  }
  return 'default';
}
