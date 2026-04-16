import { Injectable, inject } from '@angular/core';
import { serverTimestamp } from '@angular/fire/firestore';
import { DEFAULT_ROUND_TIMER_DURATION_SEC, FinalEstimateMethod, VoteCard } from '@app/core/models';
import { Observable, catchError, concatMap, of, switchMap, throwError } from 'rxjs';
import { SESSION_REPOSITORY, STORY_REPOSITORY, VOTE_REPOSITORY } from '@app/core/tokens/repository.tokens';
import { CreateSessionStoryParams, UpdateStoryPatch } from '@app/data/repositories/story.repository';
import { parseJiraIssueKey } from '@app/shared/utils/jira-issue-key.utils';
import { normalizeJiraSiteUrl } from '@app/shared/utils/jira-site.utils';

export type SessionModerationFailure =
  | 'SESSION_NOT_FOUND'
  | 'NOT_MODERATOR'
  | 'NO_ACTIVE_STORY'
  | 'SESSION_NOT_ACTIVE'
  | 'STORY_NOT_FOUND'
  | 'INVALID_STORY_TITLE'
  | 'ROUND_NOT_REVEALED'
  | 'INVALID_JIRA_ISSUE_KEY'
  | 'INVALID_JIRA_SITE'
  | 'INVALID_JIRA_BOARD_ID'
  | 'TRANSFER_INVALID_MEMBER'
  | 'TRANSFER_SAME_AS_CURRENT';

@Injectable({ providedIn: 'root' })
export class SessionModerationService {
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly votes = inject(VOTE_REPOSITORY);
  private readonly stories = inject(STORY_REPOSITORY);

  /**
   * Reveal: only moderator, active session with a story, idempotent if already revealed.
   */
  revealVotes(sessionId: string, moderatorUid: string): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        if (!session.activeStoryId) {
          return throwError(() => this.err('NO_ACTIVE_STORY'));
        }
        if (session.revealState.revealed) {
          return of(undefined);
        }
        return this.sessions.revealVotes(sid, moderatorUid);
      }),
    );
  }

  /**
   * Reset: only moderator; deletes all vote docs for current story + round, then hides reveal and increments epoch.
   * Members and story documents unchanged.
   */
  resetVotingRound(sessionId: string, moderatorUid: string): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        const storyId = session.activeStoryId;
        if (!storyId) {
          return throwError(() => this.err('NO_ACTIVE_STORY'));
        }
        const epoch = session.revealState.roundEpoch;
        return this.votes.deleteVotesForStoryRound(sid, storyId, epoch).pipe(
          concatMap(() => this.sessions.resetVotingRound(sid)),
          concatMap(() =>
            this.stories.updateStory(sid, storyId, { clearFinalEstimateState: true }),
          ),
        );
      }),
    );
  }

  /**
   * Create a story. When `makeActive` is true, session points to the new story with a fresh round
   * and the previous active story is marked completed.
   */
  createStory(
    sessionId: string,
    moderatorUid: string,
    input: Pick<CreateSessionStoryParams, 'title' | 'description' | 'makeActive' | 'jiraIssueKey'>,
  ): Observable<string> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    const title = input.title.trim();
    if (!title) {
      return throwError(() => this.err('INVALID_STORY_TITLE'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        return this.stories.createStory(sid, {
          title: input.title,
          description: input.description,
          createdBy: moderatorUid,
          makeActive: input.makeActive,
          previousActiveStoryId: session.activeStoryId,
          jiraIssueKey: input.jiraIssueKey ?? null,
        });
      }),
    );
  }

  /**
   * Update title/description of the story that is currently active on the session.
   */
  updateActiveStory(
    sessionId: string,
    moderatorUid: string,
    patch: { title?: string; description?: string },
  ): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    if (patch.title !== undefined && !patch.title.trim()) {
      return throwError(() => this.err('INVALID_STORY_TITLE'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        const storyId = session.activeStoryId;
        if (!storyId) {
          return throwError(() => this.err('NO_ACTIVE_STORY'));
        }
        return this.stories.updateStory(sid, storyId, {
          title: patch.title,
          description: patch.description,
        });
      }),
    );
  }

  /**
   * Make an existing story the active voting target with a fresh hidden round.
   */
  /** Start countdown from now (server time). Idempotent if already running. */
  startRoundTimer(sessionId: string, moderatorUid: string): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        return this.sessions.patchRoundTimer(sid, {
          isRunning: true,
          startedAt: serverTimestamp(),
        });
      }),
    );
  }

  stopRoundTimer(sessionId: string, moderatorUid: string): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        return this.sessions.patchRoundTimer(sid, {
          isRunning: false,
          startedAt: null,
        });
      }),
    );
  }

  /**
   * Stop timer and clear start time. Optionally reset duration to default (60s).
   */
  resetRoundTimer(sessionId: string, moderatorUid: string, resetDuration = false): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        return this.sessions.patchRoundTimer(sid, {
          isRunning: false,
          startedAt: null,
          ...(resetDuration ? { durationSec: DEFAULT_ROUND_TIMER_DURATION_SEC } : {}),
        });
      }),
    );
  }

  setRoundTimerDuration(sessionId: string, moderatorUid: string, durationSec: number): Observable<void> {
    const sid = sessionId.trim();
    const d = Math.min(3600, Math.max(10, Math.round(durationSec)));
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        return this.sessions.patchRoundTimer(sid, { durationSec: d });
      }),
    );
  }

  /**
   * Persist moderator’s chosen final estimate (post-reveal) on the active story.
   */
  setActiveStoryFinalEstimate(
    sessionId: string,
    moderatorUid: string,
    input: { method: FinalEstimateMethod; card: VoteCard },
  ): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        const storyId = session.activeStoryId;
        if (!storyId) {
          return throwError(() => this.err('NO_ACTIVE_STORY'));
        }
        if (!session.revealState.revealed) {
          return throwError(() => this.err('ROUND_NOT_REVEALED'));
        }
        return this.stories.updateStory(sid, storyId, {
          finalEstimateMethod: input.method,
          finalEstimateCard: input.card,
        });
      }),
    );
  }

  /**
   * Persist Jira site / connected flag for the session (moderator only).
   * Pass a normalized site URL from the UI, or `null` to clear.
   */
  updateSessionJiraSettings(
    sessionId: string,
    moderatorUid: string,
    input: { jiraSiteUrl: string | null; jiraConnected: boolean },
  ): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    const site = input.jiraSiteUrl === null ? null : normalizeJiraSiteUrl(input.jiraSiteUrl);
    if (input.jiraSiteUrl !== null && input.jiraSiteUrl.trim() !== '' && site === null) {
      return throwError(() => this.err('INVALID_JIRA_SITE'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        return this.sessions.patchJiraSettings(sid, {
          jiraSiteUrl: site,
          jiraConnected: input.jiraConnected || Boolean(site),
        });
      }),
    );
  }

  /**
   * Sets `settings.jiraBoardId` for Agile board estimation (moderator only).
   * Empty string clears. Value must be numeric (Jira board id).
   */
  updateSessionJiraBoardId(sessionId: string, moderatorUid: string, rawBoardId: string): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    const trimmed = rawBoardId.trim();
    const boardId = trimmed === '' ? null : trimmed;
    if (boardId !== null && !/^\d+$/.test(boardId)) {
      return throwError(() => this.err('INVALID_JIRA_BOARD_ID'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        return this.sessions.patchJiraSettings(sid, { jiraBoardId: boardId });
      }),
    );
  }

  /** Sets `jiraIssueKey` on the active story (moderator only). Empty string clears the key. */
  setActiveStoryJiraIssueKey(
    sessionId: string,
    moderatorUid: string,
    rawIssueKey: string,
    fromJira?: { readonly title: string; readonly description: string } | null,
  ): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    const trimmed = rawIssueKey.trim();
    const parsed = trimmed === '' ? null : parseJiraIssueKey(trimmed);
    if (trimmed !== '' && parsed === null) {
      return throwError(() => this.err('INVALID_JIRA_ISSUE_KEY'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        const storyId = session.activeStoryId;
        if (!storyId) {
          return throwError(() => this.err('NO_ACTIVE_STORY'));
        }
        const patch: UpdateStoryPatch = { jiraIssueKey: parsed };
        if (parsed !== null && fromJira) {
          patch.title = fromJira.title;
          patch.description = fromJira.description;
        }
        return this.stories.updateStory(sid, storyId, patch);
      }),
    );
  }

  /** Sets `jiraSyncedAt` to server time on the active story (after a successful Jira API call). */
  markActiveStoryJiraSynced(sessionId: string, moderatorUid: string): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        const storyId = session.activeStoryId;
        if (!storyId) {
          return throwError(() => this.err('NO_ACTIVE_STORY'));
        }
        return this.stories.updateStory(sid, storyId, { markJiraSynced: true });
      }),
    );
  }

  /**
   * Hands moderator role to another session member. Updates session `moderatorId` and both members' `role`.
   */
  transferModerator(sessionId: string, moderatorUid: string, newModeratorUid: string): Observable<void> {
    const sid = sessionId.trim();
    const next = newModeratorUid.trim();
    if (!sid || !next) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    if (next === moderatorUid) {
      return throwError(() => this.err('TRANSFER_SAME_AS_CURRENT'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        return this.sessions.transferModerator(sid, moderatorUid, next).pipe(
          catchError((err: unknown) => {
            if (err instanceof Error && err.message === 'TRANSFER_INVALID_MEMBER') {
              return throwError(() => this.err('TRANSFER_INVALID_MEMBER'));
            }
            return throwError(() => err);
          }),
        );
      }),
    );
  }

  /** Persists `settings.autoRevealWhenAllVoted` (moderator-only). */
  setAutoRevealWhenAllVoted(
    sessionId: string,
    moderatorUid: string,
    enabled: boolean,
  ): Observable<void> {
    const sid = sessionId.trim();
    if (!sid) {
      return throwError(() => this.err('SESSION_NOT_FOUND'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        return this.sessions.patchBehaviorSettings(sid, { autoRevealWhenAllVoted: enabled });
      }),
    );
  }

  switchActiveStory(sessionId: string, moderatorUid: string, storyId: string): Observable<void> {
    const sid = sessionId.trim();
    const nextId = storyId.trim();
    if (!sid || !nextId) {
      return throwError(() => this.err('STORY_NOT_FOUND'));
    }
    return this.sessions.getSessionOnce(sid).pipe(
      switchMap((session) => {
        if (!session) {
          return throwError(() => this.err('SESSION_NOT_FOUND'));
        }
        if (session.moderatorId !== moderatorUid) {
          return throwError(() => this.err('NOT_MODERATOR'));
        }
        if (session.status !== 'active') {
          return throwError(() => this.err('SESSION_NOT_ACTIVE'));
        }
        if (session.activeStoryId === nextId) {
          return of(undefined);
        }
        return this.stories.getStoryOnce(sid, nextId).pipe(
          switchMap((story) => {
            if (!story) {
              return throwError(() => this.err('STORY_NOT_FOUND'));
            }
            return this.sessions.setActiveStoryAndResetRound(sid, nextId, session.activeStoryId);
          }),
        );
      }),
    );
  }

  userMessageForFailure(code: SessionModerationFailure): string {
    switch (code) {
      case 'SESSION_NOT_FOUND':
        return 'Session is no longer available.';
      case 'NOT_MODERATOR':
        return 'Only the moderator can perform this action.';
      case 'NO_ACTIVE_STORY':
        return 'There is no active story to vote on yet.';
      case 'SESSION_NOT_ACTIVE':
        return 'This session is not active.';
      case 'STORY_NOT_FOUND':
        return 'That story is no longer available.';
      case 'INVALID_STORY_TITLE':
        return 'Story title cannot be empty.';
      case 'ROUND_NOT_REVEALED':
        return 'Reveal votes before choosing a final estimate.';
      case 'INVALID_JIRA_ISSUE_KEY':
        return 'Enter a valid Jira issue key (for example EVRST-1386).';
      case 'INVALID_JIRA_SITE':
        return 'Enter a valid Jira site URL (for example https://your-team.atlassian.net).';
      case 'INVALID_JIRA_BOARD_ID':
        return 'Board id must be numeric (open a board in Jira and read the id from the URL).';
      case 'TRANSFER_INVALID_MEMBER':
        return 'That participant is not in this session.';
      case 'TRANSFER_SAME_AS_CURRENT':
        return 'Pick a different participant to become moderator.';
      default:
        return 'Action could not be completed.';
    }
  }

  private err(code: SessionModerationFailure): Error & { moderationCode: SessionModerationFailure } {
    const e = new Error(code) as Error & { moderationCode: SessionModerationFailure };
    e.moderationCode = code;
    return e;
  }
}
