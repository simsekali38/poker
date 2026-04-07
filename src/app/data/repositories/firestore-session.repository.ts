import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  doc,
  docData,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, defer, from, map, of } from 'rxjs';
import { Session } from '@app/core/models';
import { SESSIONS_COLLECTION } from '@app/data/firebase/firestore-paths';
import { mapSessionDocument, mapSessionSnapshot } from '@app/data/mappers/session-doc.mapper';
import { cardsForDeckPreset } from '@app/shared/utils/deck-presets';
import { generateEntityId, generateSessionId } from '@app/shared/utils/id.utils';
import { CreateSessionAsModeratorParams, SessionRepository } from './session.repository';

@Injectable({ providedIn: 'root' })
export class FirestoreSessionRepository implements SessionRepository {
  private readonly firestore = inject(Firestore);

  watchSession(sessionId: string): Observable<Session | null> {
    const id = sessionId.trim();
    if (!id) {
      return of(null);
    }
    const ref = doc(this.firestore, SESSIONS_COLLECTION, id);
    return docData(ref).pipe(
      map((data) => (data ? mapSessionDocument(id, data as DocumentData) : null)),
    );
  }

  getSessionOnce(sessionId: string): Observable<Session | null> {
    const id = sessionId.trim();
    if (!id) {
      return of(null);
    }
    const ref = doc(this.firestore, SESSIONS_COLLECTION, id);
    return defer(() => from(getDoc(ref))).pipe(map((snap) => mapSessionSnapshot(snap)));
  }

  createSessionAsModerator(params: CreateSessionAsModeratorParams): Observable<string> {
    return defer(() => from(this.commitNewSession(params)));
  }

  revealVotes(sessionId: string, revealedByMemberId: string): Observable<void> {
    return defer(() => from(this.commitReveal(sessionId.trim(), revealedByMemberId)));
  }

  resetVotingRound(sessionId: string): Observable<void> {
    return defer(() => from(this.commitResetRound(sessionId.trim())));
  }

  setActiveStoryAndResetRound(
    sessionId: string,
    newStoryId: string,
    previousActiveStoryId: string | null,
  ): Observable<void> {
    return defer(() =>
      from(this.commitSetActiveStoryAndResetRound(sessionId.trim(), newStoryId, previousActiveStoryId)),
    );
  }

  private async commitReveal(sessionId: string, revealedByMemberId: string): Promise<void> {
    const ref = doc(this.firestore, SESSIONS_COLLECTION, sessionId);
    await updateDoc(ref, {
      'revealState.revealed': true,
      'revealState.revealedAt': serverTimestamp(),
      'revealState.revealedByMemberId': revealedByMemberId,
      updatedAt: serverTimestamp(),
    });
  }

  private async commitResetRound(sessionId: string): Promise<void> {
    const ref = doc(this.firestore, SESSIONS_COLLECTION, sessionId);
    await updateDoc(ref, {
      'revealState.revealed': false,
      'revealState.revealedAt': null,
      'revealState.revealedByMemberId': null,
      'revealState.roundEpoch': increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  private async commitSetActiveStoryAndResetRound(
    sessionId: string,
    newStoryId: string,
    previousActiveStoryId: string | null,
  ): Promise<void> {
    const batch = writeBatch(this.firestore);
    const sessionRef = doc(this.firestore, SESSIONS_COLLECTION, sessionId);
    const revealState = {
      storyId: newStoryId,
      roundEpoch: 1,
      revealed: false,
      revealedAt: null,
      revealedByMemberId: null,
    };
    batch.update(sessionRef, {
      activeStoryId: newStoryId,
      revealState,
      updatedAt: serverTimestamp(),
    });

    if (previousActiveStoryId && previousActiveStoryId !== newStoryId) {
      const prevRef = doc(this.firestore, SESSIONS_COLLECTION, sessionId, 'stories', previousActiveStoryId);
      batch.update(prevRef, { status: 'completed', updatedAt: serverTimestamp() });
    }

    const nextRef = doc(this.firestore, SESSIONS_COLLECTION, sessionId, 'stories', newStoryId);
    batch.update(nextRef, { status: 'active', updatedAt: serverTimestamp() });

    await batch.commit();
  }

  private async commitNewSession(params: CreateSessionAsModeratorParams): Promise<string> {
    const sessionId = generateSessionId();
    const batch = writeBatch(this.firestore);
    const sessionRef = doc(this.firestore, SESSIONS_COLLECTION, sessionId);

    const storyTitle = params.initialStoryTitle.trim();
    const storyId = generateEntityId();
    const deckCards = cardsForDeckPreset(params.deckPresetId);

    const revealState = {
      storyId,
      roundEpoch: 1,
      revealed: false,
      revealedAt: null,
      revealedByMemberId: null,
    };

    batch.set(sessionRef, {
      title: params.sessionTitle.trim(),
      moderatorId: params.moderatorUid,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      settings: {
        deckPresetId: params.deckPresetId,
        cards: [...deckCards],
        allowVoteChangesBeforeReveal: true,
      },
      activeStoryId: storyId,
      revealState,
    });

    const memberRef = doc(
      this.firestore,
      SESSIONS_COLLECTION,
      sessionId,
      'members',
      params.moderatorUid,
    );
    batch.set(memberRef, {
      displayName: params.moderatorDisplayName.trim(),
      role: 'moderator',
      joinedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      isOnline: true,
      updatedAt: serverTimestamp(),
    });

    const storyRef = doc(this.firestore, SESSIONS_COLLECTION, sessionId, 'stories', storyId);
    batch.set(storyRef, {
      title: storyTitle,
      description: '',
      status: 'active',
      createdBy: params.moderatorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return sessionId;
  }
}
