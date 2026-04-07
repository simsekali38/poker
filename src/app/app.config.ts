import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideFirebaseAppAndFirestore } from '@app/data/firebase/firebase-app.providers';
import {
  SESSION_MEMBER_REPOSITORY,
  SESSION_REPOSITORY,
  STORY_REPOSITORY,
  VOTE_REPOSITORY,
} from '@app/core/tokens/repository.tokens';
import { FirestoreSessionMemberRepository } from '@app/data/repositories/firestore-session-member.repository';
import { FirestoreSessionRepository } from '@app/data/repositories/firestore-session.repository';
import { FirestoreStoryRepository } from '@app/data/repositories/firestore-story.repository';
import { FirestoreVoteRepository } from '@app/data/repositories/firestore-vote.repository';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    ...provideFirebaseAppAndFirestore(),
    { provide: SESSION_REPOSITORY, useExisting: FirestoreSessionRepository },
    { provide: SESSION_MEMBER_REPOSITORY, useExisting: FirestoreSessionMemberRepository },
    { provide: STORY_REPOSITORY, useExisting: FirestoreStoryRepository },
    { provide: VOTE_REPOSITORY, useExisting: FirestoreVoteRepository },
  ],
};
