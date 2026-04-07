import { UserId } from './user-identity.model';
import { EntityId } from './entity-id.model';
import { RevealState } from './reveal-state.model';
import { RoundTimerState } from './round-timer.model';
import { SessionSettings } from './session-settings.model';

export type SessionStatus = 'lobby' | 'active' | 'archived';

export interface Session {
  id: EntityId;
  title: string;
  moderatorId: UserId;
  createdAt: Date;
  status: SessionStatus;
  settings: SessionSettings;
  revealState: RevealState;
  activeStoryId: EntityId | null;
  updatedAt: Date;
  /** Optional voting round timer; omitted on legacy docs until first write. */
  roundTimer: RoundTimerState;
}
