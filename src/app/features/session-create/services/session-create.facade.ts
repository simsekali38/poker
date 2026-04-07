import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { SESSION_REPOSITORY } from '@app/core/tokens/repository.tokens';
import { AuthSessionService } from '@app/core/services/auth-session.service';
import { SessionLocalIdentityService } from '@app/core/services/session-local-identity.service';
import { SessionCreateFormValue } from '../models/session-create-form.model';

@Injectable({ providedIn: 'root' })
export class SessionCreateFacade {
  private readonly auth = inject(AuthSessionService);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly localIdentity = inject(SessionLocalIdentityService);

  /**
   * Anonymous sign-in (if needed) then atomic session bootstrap in Firestore.
   */
  create(value: SessionCreateFormValue): Observable<string> {
    const initialStoryTitle = value.initialStoryTitle.trim();
    const displayName = value.moderatorDisplayName.trim();
    return this.auth.ensureAnonymousSignIn().pipe(
      switchMap((moderatorUid) =>
        this.sessions
          .createSessionAsModerator({
            sessionTitle: value.sessionTitle.trim(),
            moderatorDisplayName: displayName,
            moderatorUid,
            deckPresetId: value.deckPresetId,
            initialStoryTitle,
          })
          .pipe(
            tap((sessionId) =>
              this.localIdentity.saveBinding(sessionId, {
                memberId: moderatorUid,
                displayName,
              }),
            ),
          ),
      ),
    );
  }
}
