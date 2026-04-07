import { Injectable, inject } from '@angular/core';
import { Observable, concatMap, of, switchMap, throwError } from 'rxjs';
import { SESSION_REPOSITORY, STORY_REPOSITORY, VOTE_REPOSITORY } from '@app/core/tokens/repository.tokens';
import { CreateSessionStoryParams } from '@app/data/repositories/story.repository';

export type SessionModerationFailure =
  | 'SESSION_NOT_FOUND'
  | 'NOT_MODERATOR'
  | 'NO_ACTIVE_STORY'
  | 'SESSION_NOT_ACTIVE'
  | 'STORY_NOT_FOUND'
  | 'INVALID_STORY_TITLE';

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
    input: Pick<CreateSessionStoryParams, 'title' | 'description' | 'makeActive'>,
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
