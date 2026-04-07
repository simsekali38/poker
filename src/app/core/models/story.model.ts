import { UserId } from './user-identity.model';
import { EntityId } from './entity-id.model';

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
}
