import { Observable } from 'rxjs';
import { Story, StoryStatus } from '@app/core/models';

export interface CreateSessionStoryParams {
  title: string;
  description: string;
  createdBy: string;
  /** When true, story is created as `active` and the session points to it with a fresh voting round. */
  makeActive: boolean;
  /** `session.activeStoryId` before activation; will be marked `completed` when `makeActive` and non-null. */
  previousActiveStoryId: string | null;
}

export interface UpdateStoryPatch {
  title?: string;
  description?: string;
  status?: StoryStatus;
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
