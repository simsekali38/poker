import { UserId } from './user-identity.model';
import { EntityId } from './entity-id.model';

export type ModeratorActionType =
  | 'session.created'
  | 'session.settings.updated'
  | 'story.created'
  | 'story.updated'
  | 'vote.round.reset'
  | 'vote.revealed'
  | 'session.status.changed';

export interface ModeratorActionAudit {
  id: EntityId;
  sessionId: EntityId;
  moderatorId: UserId;
  action: ModeratorActionType;
  storyId?: EntityId;
  roundEpoch?: number;
  payload?: Readonly<Record<string, unknown>>;
  occurredAt: Date;
}
