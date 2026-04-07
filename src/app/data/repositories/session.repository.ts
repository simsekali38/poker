import { Observable } from 'rxjs';
import { DeckPresetId } from '@app/core/models';
import { Session } from '@app/core/models';

export interface CreateSessionAsModeratorParams {
  sessionTitle: string;
  moderatorDisplayName: string;
  moderatorUid: string;
  deckPresetId: DeckPresetId;
  /** Trimmed, non-empty first story title (required). */
  initialStoryTitle: string;
}

/**
 * Session aggregate (Firestore: `planning_poker_sessions/{sessionId}`).
 */
export interface SessionRepository {
  /** Realtime stream of the session document. */
  watchSession(sessionId: string): Observable<Session | null>;

  /** One-shot read for guards and join validation. */
  getSessionOnce(sessionId: string): Observable<Session | null>;

  /**
   * Atomically creates the session document, moderator member, and first story.
   * @returns The new session id.
   */
  createSessionAsModerator(params: CreateSessionAsModeratorParams): Observable<string>;

  /** Sets revealState.revealed; must be enforced by rules for moderators only. */
  revealVotes(sessionId: string, revealedByMemberId: string): Observable<void>;

  /**
   * Session doc only: clears reveal flags and increments `revealState.roundEpoch`.
   * Call after vote documents for the prior round are deleted (see `SessionModerationService`).
   */
  resetVotingRound(sessionId: string): Observable<void>;

  /**
   * Atomically: set `activeStoryId`, reset `revealState` for a fresh round, mark the previous
   * active story `completed` (if any and different), and mark `newStoryId` as `active`.
   */
  setActiveStoryAndResetRound(
    sessionId: string,
    newStoryId: string,
    previousActiveStoryId: string | null,
  ): Observable<void>;
}
