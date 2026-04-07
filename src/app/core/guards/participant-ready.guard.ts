import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map, take } from 'rxjs';
import { SessionLocalIdentityService } from '@app/core/services/session-local-identity.service';

/**
 * Requires Firebase Auth + a saved local binding for this session (same uid).
 * Uses the first `authState` emission so anonymous restore after refresh is respected
 * (unlike a synchronous `currentUser` check).
 */
export const participantReadyGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const auth = inject(Auth);
  const localIdentity = inject(SessionLocalIdentityService);
  const raw = route.paramMap.get('sessionId');
  const sessionId = raw?.trim() ?? '';
  if (!sessionId) {
    return router.createUrlTree(['/']);
  }
  return authState(auth).pipe(
    take(1),
    map((user) => {
      if (!user) {
        return router.createUrlTree(['/session/join', sessionId]);
      }
      const binding = localIdentity.readBinding(sessionId);
      if (!binding || binding.memberId !== user.uid) {
        return router.createUrlTree(['/session/join', sessionId]);
      }
      return true;
    }),
  );
};
