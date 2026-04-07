import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { SESSION_REPOSITORY } from '@app/core/tokens/repository.tokens';

/** Ensures the session document exists before opening the room. */
export const sessionExistsGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const sessions = inject(SESSION_REPOSITORY);
  const raw = route.paramMap.get('sessionId');
  const sessionId = raw?.trim() ?? '';
  if (!sessionId) {
    return router.createUrlTree(['/']);
  }
  return sessions.getSessionOnce(sessionId).pipe(
    map((session) => {
      if (!session) {
        return router.createUrlTree(['/session/join', sessionId]);
      }
      if (session.status === 'archived') {
        return router.createUrlTree(['/session/join', sessionId]);
      }
      return true;
    }),
    catchError(() => of(router.createUrlTree(['/session/join', sessionId]))),
  );
};
