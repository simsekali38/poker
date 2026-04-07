import { UserId } from './user-identity.model';
import { EntityId } from './entity-id.model';
import { VoteCard } from './vote-card.model';

export interface Vote {
  id: EntityId;
  sessionId: EntityId;
  storyId: EntityId;
  memberId: UserId;
  selectedCard: VoteCard;
  submittedAt: Date;
  roundEpoch: number;
  updatedAt: Date;
}
