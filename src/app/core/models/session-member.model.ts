import { UserId } from './user-identity.model';
import { EntityId } from './entity-id.model';

export type SessionMemberRole = 'moderator' | 'participant';

export interface SessionMember {
  id: UserId;
  sessionId: EntityId;
  displayName: string;
  role: SessionMemberRole;
  joinedAt: Date;
  isOnline: boolean;
  lastSeenAt: Date;
  updatedAt: Date;
}
