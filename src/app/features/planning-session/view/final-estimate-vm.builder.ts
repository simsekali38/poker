import { environment } from '@env/environment';
import { FinalEstimateMethod, Session, Story, Vote, VoteCard } from '@app/core/models';
import {
  consensusNumericVote,
  numericCardsFromDeckOrdered,
  roundAverageToNearestDeckCard,
} from '@app/shared/utils/final-estimate.utils';
import { parseJiraIssueKey } from '@app/shared/utils/jira-issue-key.utils';

export interface FinalEstimateConsensusVm {
  readonly available: boolean;
  readonly card: VoteCard | null;
  readonly unavailableReason: string;
}

export interface FinalEstimateAverageVm {
  readonly available: boolean;
  readonly rawAverage: number | null;
  readonly roundedCard: VoteCard | null;
  readonly unavailableReason: string;
}

/** Post-reveal moderator flow: choose how to set the final estimate, then send to Jira. */
export interface FinalEstimateDecisionVm {
  readonly jiraIntegrationAvailable: boolean;
  /** Explains why Jira actions are disabled (integration off, or already synced, etc.). */
  readonly jiraActionHint: string | null;
  readonly canSendToJira: boolean;
  readonly consensus: FinalEstimateConsensusVm;
  readonly average: FinalEstimateAverageVm;
  readonly moderatorPickOptions: readonly VoteCard[];
  /** Active story snapshot for persisted selection + sync state. */
  readonly story: Story;
  /** Session Jira site (for API payload and display). */
  readonly jiraSiteUrl: string | null;
  /** True when the session has a linked Jira site or OAuth completed. */
  readonly jiraSessionReady: boolean;
  /** Story has a valid `PROJ-123` style key. */
  readonly hasValidJiraIssueKey: boolean;
  /** Optional Scrum board id from `session.settings` (Jira Agile estimation). */
  readonly jiraBoardId: string | null;
}

function jiraIntegrationAvailable(session: Session): boolean {
  if (!environment.jiraIntegrationEnabled) {
    return false;
  }
  if (!environment.jiraBackendApiUrl?.trim()) {
    return false;
  }
  if (session.settings.jiraIntegrationEnabled === false) {
    return false;
  }
  return true;
}

export function buildFinalEstimateDecisionVm(args: {
  session: Session;
  story: Story | null;
  votes: Vote[];
  votesRevealed: boolean;
  isModerator: boolean;
  deck: readonly VoteCard[];
  numericAverage: number | null;
}): FinalEstimateDecisionVm | null {
  if (!args.isModerator || !args.votesRevealed || !args.story) {
    return null;
  }

  const jiraOk = jiraIntegrationAvailable(args.session);
  const consensus = consensusNumericVote(args.votes);
  const raw = args.numericAverage;
  const rounded = raw !== null ? roundAverageToNearestDeckCard(raw, args.deck) : null;
  const averageAvailable = raw !== null && rounded !== null;

  let averageReason = '';
  if (raw === null) {
    averageReason = 'No numeric votes — cannot compute an average.';
  } else if (rounded === null) {
    averageReason = 'Deck has no numeric cards to round to.';
  }

  const story = args.story;
  const hasCard = story.finalEstimateCard !== null;
  const synced = story.jiraSyncedAt !== null;
  const jiraSiteUrl = args.session.settings.jiraSiteUrl?.trim() || null;
  const jiraSessionReady =
    args.session.settings.jiraConnected === true || Boolean(jiraSiteUrl);
  const hasValidJiraIssueKey = parseJiraIssueKey(story.jiraIssueKey ?? '') !== null;
  const jiraBoardId = args.session.settings.jiraBoardId?.trim() || null;

  let jiraActionHint: string | null = null;
  if (!jiraOk) {
    jiraActionHint =
      !environment.jiraIntegrationEnabled || !environment.jiraBackendApiUrl?.trim()
        ? 'Jira integration is not configured for this deployment.'
        : 'Jira integration is turned off for this session.';
  } else if (synced) {
    jiraActionHint = 'Final estimate was already sent to Jira for this story.';
  } else if (!hasCard) {
    jiraActionHint = 'Choose a final estimate using one of the options above before sending.';
  } else if (!jiraSessionReady) {
    jiraActionHint =
      'Add your Jira site URL below or use Connect Jira before sending the estimate.';
  } else if (!hasValidJiraIssueKey) {
    jiraActionHint = 'Enter the Jira issue key for this story (for example PROJ-123) before sending.';
  }

  const canSendToJira =
    jiraOk && hasCard && !synced && jiraSessionReady && hasValidJiraIssueKey;

  return {
    jiraIntegrationAvailable: jiraOk,
    jiraActionHint,
    canSendToJira,
    jiraSiteUrl,
    jiraSessionReady,
    hasValidJiraIssueKey,
    jiraBoardId,
    consensus: {
      available: consensus.available,
      card: consensus.card,
      unavailableReason: consensus.unavailableReason,
    },
    average: {
      available: averageAvailable,
      rawAverage: raw,
      roundedCard: rounded,
      unavailableReason: averageReason,
    },
    moderatorPickOptions: numericCardsFromDeckOrdered(args.deck),
    story,
  };
}

export function isMethodSelected(story: Story, method: FinalEstimateMethod): boolean {
  return story.finalEstimateMethod === method;
}
