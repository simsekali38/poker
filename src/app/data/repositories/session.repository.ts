import { Observable } from 'rxjs';
import { DeckPresetId } from '@app/core/models';
import { Session } from '@app/core/models';

/** Partial update for `session.roundTimer.*` (Firestore dot paths). */
export interface SessionRoundTimerPatch {
  durationSec?: number;
  isRunning?: boolean;
  /** Use Firestore `serverTimestamp()` when starting; `null` when clearing. */
  startedAt?: unknown;
}

/** Nested under `settings.*` on the session document. */
export interface SessionJiraSettingsPatch {
  jiraSiteUrl?: string | null;
  jiraConnected?: boolean;
  /** Scrum board id for Jira Agile estimation; `null` clears. */
  jiraBoardId?: string | null;
}

/** Session voting behavior flags under `settings.*`. */
export interface SessionBehaviorSettingsPatch {
  autoRevealWhenAllVoted?: boolean;
}

export interface CreateSessionAsModeratorParams {
  sessionTitle: string;
  moderatorDisplayName: string;
  moderatorUid: string;
  deckPresetId: DeckPresetId;
  /** Trimmed, non-empty first story title (required). */
  initialStoryTitle: string;
  /** Optional Jira Cloud base URL. */
  jiraSiteUrl?: string | null;
  /** Set when OAuth redirect succeeded or user confirmed site for this session. */
  jiraConnected?: boolean;
  /** Optional issue key for the first story (e.g. EVRST-1386). */
  initialStoryJiraIssueKey?: string | null;
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

  /** Updates nested `roundTimer` fields (moderator-only in rules). */
  patchRoundTimer(sessionId: string, patch: SessionRoundTimerPatch): Observable<void>;

  /** Updates `settings.jiraSiteUrl` / `settings.jiraConnected` (moderator-only in rules). */
  patchJiraSettings(sessionId: string, patch: SessionJiraSettingsPatch): Observable<void>;

  /** Updates `settings.autoRevealWhenAllVoted` (moderator-only in rules). */
  patchBehaviorSettings(sessionId: string, patch: SessionBehaviorSettingsPatch): Observable<void>;

  /**
   * Sets `moderatorId` and updates both members' `role` fields (moderator-only).
   */
  transferModerator(
    sessionId: string,
    previousModeratorUid: string,
    newModeratorUid: string,
  ): Observable<void>;

  /** Deletes `members/{memberId}` if it exists (moderator-only in rules). */
  deleteSessionMember(sessionId: string, memberId: string): Observable<void>;
}
