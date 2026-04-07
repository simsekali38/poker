import { DeckPresetId, VoteCard } from './vote-card.model';

export interface SessionSettings {
  deckPresetId: DeckPresetId;
  cards: readonly VoteCard[];
  allowVoteChangesBeforeReveal: boolean;
  autoRevealWhenAllVoted?: boolean;
}
