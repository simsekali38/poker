import { UserId } from './user-identity.model';
import { EntityId } from './entity-id.model';
import { VoteCard } from './vote-card.model';
import { FinalEstimateMethod } from './final-estimate.model';

export type StoryStatus = 'draft' | 'active' | 'completed' | 'skipped';

export interface Story {
  id: EntityId;
  sessionId: EntityId;
  title: string;
  description: string;
  status: StoryStatus;
  createdBy: UserId;
  createdAt: Date;
  updatedAt: Date;
  /** Moderator’s chosen final estimate for this story (post-reveal). */
  finalEstimateMethod: FinalEstimateMethod | null;
  finalEstimateCard: VoteCard | null;
  /** Set when the estimate was successfully pushed to Jira (same round). */
  jiraSyncedAt: Date | null;
  /** Target Jira issue (e.g. `EVRST-1386`). Required before sending estimate to Jira. */
  jiraIssueKey: string | null;
}
