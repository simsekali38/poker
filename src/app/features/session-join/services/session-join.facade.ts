import { Injectable, inject } from '@angular/core';
import { Observable, of, switchMap, tap, throwError } from 'rxjs';
import { Session } from '@app/core/models';
import { AuthSessionService } from '@app/core/services/auth-session.service';
import { SessionLocalIdentityService } from '@app/core/services/session-local-identity.service';
import { SESSION_MEMBER_REPOSITORY, SESSION_REPOSITORY } from '@app/core/tokens/repository.tokens';
import { joinFlowError } from '../models/join-flow-error';

@Injectable({ providedIn: 'root' })
export class SessionJoinFacade {
  private readonly auth = inject(AuthSessionService);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly members = inject(SESSION_MEMBER_REPOSITORY);
  private readonly localIdentity = inject(SessionLocalIdentityService);

  /**
   * Loads session after optional anonymous sign-in (required if rules need auth to read).
   */
  validateSessionForJoinPage(sessionId: string): Observable<Session> {
    const id = sessionId.trim();
    if (!id) {
      return throwError(() => joinFlowError('not_found'));
    }
    return this.auth.ensureAnonymousSignIn().pipe(
      switchMap(() => this.sessions.getSessionOnce(id)),
      switchMap((session) => this.assertJoinable(session)),
    );
  }

  /**
   * Writes member doc (moderator vs participant decided from session.moderatorId), then persists local binding.
   */
  join(sessionId: string, displayName: string): Observable<void> {
    const id = sessionId.trim();
    const name = displayName.trim();
    if (!id || name.length < 2) {
      return throwError(() => new Error('invalid_join_input'));
    }
    return this.auth.ensureAnonymousSignIn().pipe(
      switchMap((uid) =>
        this.sessions.getSessionOnce(id).pipe(
          switchMap((session) => this.assertJoinable(session)),
          switchMap((session) => {
            return this.members
              .upsertMemberOnJoin({
                sessionId: id,
                memberUid: uid,
                displayName: name,
                sessionModeratorUid: session.moderatorId,
              })
              .pipe(
                tap(() =>
                  this.localIdentity.saveBinding(id, { memberId: uid, displayName: name }),
                ),
              );
          }),
        ),
      ),
    );
  }

  private assertJoinable(session: Session | null): Observable<Session> {
    if (!session) {
      return throwError(() => joinFlowError('not_found'));
    }
    if (session.status === 'archived') {
      return throwError(() => joinFlowError('closed'));
    }
    return of(session);
  }
}
