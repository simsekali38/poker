import { Injectable, inject } from '@angular/core';
import { Auth, signInAnonymously } from '@angular/fire/auth';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserId } from '@app/core/models';

/**
 * Ensures a Firebase Auth user exists (anonymous) so Firestore rules can key on `request.auth.uid`.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly auth = inject(Auth);

  /** Returns the current or newly signed-in anonymous user's uid. */
  ensureAnonymousSignIn(): Observable<UserId> {
    const current = this.auth.currentUser;
    if (current) {
      return of(current.uid);
    }
    return from(signInAnonymously(this.auth)).pipe(map((cred) => cred.user.uid));
  }
}
