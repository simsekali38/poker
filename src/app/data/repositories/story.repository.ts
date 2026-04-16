import { Observable } from 'rxjs';
import { FinalEstimateMethod, Story, StoryStatus, VoteCard } from '@app/core/models';

export interface CreateSessionStoryParams {
  title: string;
  description: string;
  createdBy: string;
  /** When true, story is created as `active` and the session points to it with a fresh voting round. */
  makeActive: boolean;
  /** `session.activeStoryId` before activation; will be marked `completed` when `makeActive` and non-null. */
  previousActiveStoryId: string | null;
  /** When set (e.g. loaded from Jira), stored on the story document. */
  jiraIssueKey?: string | null;
}

export interface UpdateStoryPatch {
  title?: string;
  description?: string;
  status?: StoryStatus;
  finalEstimateMethod?: FinalEstimateMethod | null;
  finalEstimateCard?: VoteCard | null;
  /** When true, removes final estimate + Jira sync fields (e.g. new voting round). */
  clearFinalEstimateState?: boolean;
  /** When true, sets `jiraSyncedAt` to server time. */
  markJiraSynced?: boolean;
  /** Target issue key (`EVRST-1386`). `null` removes the field. */
  jiraIssueKey?: string | null;
}

export interface StoryRepository {
  watchStory(sessionId: string, storyId: string): Observable<Story | null>;

  /** Newest first (`createdAt` descending). */
  watchStories(sessionId: string): Observable<Story[]>;

  getStoryOnce(sessionId: string, storyId: string): Observable<Story | null>;

  /** Single Firestore batch: optional session activation + story doc. */
  createStory(sessionId: string, params: CreateSessionStoryParams): Observable<string>;

  updateStory(sessionId: string, storyId: string, patch: UpdateStoryPatch): Observable<void>;
}
