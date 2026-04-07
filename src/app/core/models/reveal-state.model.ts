import { UserId } from './user-identity.model';
import { EntityId } from './entity-id.model';

export interface RevealState {
  /** Active voting story, or null when no story is selected yet. */
  storyId: EntityId | null;
  roundEpoch: number;
  revealed: boolean;
  revealedAt: Date | null;
  revealedByMemberId: UserId | null;
}
