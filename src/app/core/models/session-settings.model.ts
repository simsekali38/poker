import { DeckPresetId, VoteCard } from './vote-card.model';

export interface SessionSettings {
  deckPresetId: DeckPresetId;
  cards: readonly VoteCard[];
  allowVoteChangesBeforeReveal: boolean;
  /** Default `true` when omitted; set `false` to require manual reveal. */
  autoRevealWhenAllVoted?: boolean;
  /** When `false`, Jira actions stay disabled in the UI even if `environment.jiraIntegrationEnabled` is true. */
  jiraIntegrationEnabled?: boolean;
  /** Jira Cloud / site base URL, e.g. `https://acme.atlassian.net`. */
  jiraSiteUrl?: string | null;
  /** True after OAuth completes or moderator confirmed site URL for this session. */
  jiraConnected?: boolean;
  /** Optional Scrum board id for Jira Agile estimation API. */
  jiraBoardId?: string | null;
}
