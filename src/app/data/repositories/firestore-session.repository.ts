import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  deleteDoc,
  deleteField,
  doc,
  docData,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, defer, from, map, of } from 'rxjs';
import { DEFAULT_ROUND_TIMER_DURATION_SEC, Session } from '@app/core/models';
import { SESSIONS_COLLECTION } from '@app/data/firebase/firestore-paths';
import { mapSessionDocument, mapSessionSnapshot } from '@app/data/mappers/session-doc.mapper';
import { cardsForDeckPreset } from '@app/shared/utils/deck-presets';
import { generateEntityId, generateSessionId } from '@app/shared/utils/id.utils';
import { parseJiraIssueKey } from '@app/shared/utils/jira-issue-key.utils';
import { normalizeJiraSiteUrl } from '@app/shared/utils/jira-site.utils';
import {
  CreateSessionAsModeratorParams,
  SessionBehaviorSettingsPatch,
  SessionJiraSettingsPatch,
  SessionRepository,
  SessionRoundTimerPatch,
} from './session.repository';

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

  patchRoundTimer(sessionId: string, patch: SessionRoundTimerPatch): Observable<void> {
    return defer(() => from(this.commitPatchRoundTimer(sessionId.trim(), patch)));
  }

  patchJiraSettings(sessionId: string, patch: SessionJiraSettingsPatch): Observable<void> {
    return defer(() => from(this.commitPatchJiraSettings(sessionId.trim(), patch)));
  }

  patchBehaviorSettings(sessionId: string, patch: SessionBehaviorSettingsPatch): Observable<void> {
    return defer(() => from(this.commitPatchBehaviorSettings(sessionId.trim(), patch)));
  }

  transferModerator(
    sessionId: string,
    previousModeratorUid: string,
    newModeratorUid: string,
  ): Observable<void> {
    return defer(() =>
      from(this.commitTransferModerator(sessionId.trim(), previousModeratorUid, newModeratorUid)),
    );
  }

  deleteSessionMember(sessionId: string, memberId: string): Observable<void> {
    return defer(() => from(this.commitDeleteSessionMember(sessionId.trim(), memberId.trim())));
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
      'roundTimer.isRunning': false,
      'roundTimer.startedAt': null,
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
      'roundTimer.isRunning': false,
      'roundTimer.startedAt': null,
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
    const siteNorm = normalizeJiraSiteUrl(params.jiraSiteUrl ?? '');
    const issueNorm = parseJiraIssueKey(params.initialStoryJiraIssueKey ?? '');
    const jiraConnected =
      Boolean(siteNorm) || params.jiraConnected === true || Boolean(issueNorm);

    const revealState = {
      storyId,
      roundEpoch: 1,
      revealed: false,
      revealedAt: null,
      revealedByMemberId: null,
    };

    const settings: Record<string, unknown> = {
      deckPresetId: params.deckPresetId,
      cards: [...deckCards],
      allowVoteChangesBeforeReveal: true,
      autoRevealWhenAllVoted: true,
    };
    if (siteNorm) {
      settings['jiraSiteUrl'] = siteNorm;
    }
    if (jiraConnected) {
      settings['jiraConnected'] = true;
    }

    batch.set(sessionRef, {
      title: params.sessionTitle.trim(),
      moderatorId: params.moderatorUid,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      settings,
      activeStoryId: storyId,
      revealState,
      roundTimer: {
        durationSec: DEFAULT_ROUND_TIMER_DURATION_SEC,
        isRunning: false,
        startedAt: null,
      },
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
      finalEstimateMethod: null,
      finalEstimateCard: null,
      jiraSyncedAt: null,
      ...(issueNorm ? { jiraIssueKey: issueNorm } : {}),
    });

    await batch.commit();
    return sessionId;
  }

  private async commitPatchJiraSettings(sessionId: string, patch: SessionJiraSettingsPatch): Promise<void> {
    const ref = doc(this.firestore, SESSIONS_COLLECTION, sessionId);
    const updates: DocumentData = { updatedAt: serverTimestamp() };
    if (patch.jiraSiteUrl !== undefined) {
      updates['settings.jiraSiteUrl'] =
        patch.jiraSiteUrl === null || patch.jiraSiteUrl === '' ? deleteField() : patch.jiraSiteUrl;
    }
    if (patch.jiraConnected !== undefined) {
      updates['settings.jiraConnected'] = patch.jiraConnected;
    }
    if (patch.jiraBoardId !== undefined) {
      updates['settings.jiraBoardId'] =
        patch.jiraBoardId === null || patch.jiraBoardId === '' ? deleteField() : patch.jiraBoardId;
    }
    await updateDoc(ref, updates as DocumentData);
  }

  private async commitPatchRoundTimer(sessionId: string, patch: SessionRoundTimerPatch): Promise<void> {
    const ref = doc(this.firestore, SESSIONS_COLLECTION, sessionId);
    const updates: DocumentData = { updatedAt: serverTimestamp() };
    if (patch.durationSec !== undefined) {
      updates['roundTimer.durationSec'] = patch.durationSec;
    }
    if (patch.isRunning !== undefined) {
      updates['roundTimer.isRunning'] = patch.isRunning;
    }
    if (patch.startedAt !== undefined) {
      updates['roundTimer.startedAt'] = patch.startedAt;
    }
    await updateDoc(ref, updates as DocumentData);
  }

  private async commitPatchBehaviorSettings(
    sessionId: string,
    patch: SessionBehaviorSettingsPatch,
  ): Promise<void> {
    const ref = doc(this.firestore, SESSIONS_COLLECTION, sessionId);
    const updates: DocumentData = { updatedAt: serverTimestamp() };
    if (patch.autoRevealWhenAllVoted !== undefined) {
      updates['settings.autoRevealWhenAllVoted'] = patch.autoRevealWhenAllVoted;
    }
    await updateDoc(ref, updates as DocumentData);
  }

  private async commitTransferModerator(
    sessionId: string,
    previousModeratorUid: string,
    newModeratorUid: string,
  ): Promise<void> {
    if (previousModeratorUid === newModeratorUid) {
      return;
    }
    const sessionRef = doc(this.firestore, SESSIONS_COLLECTION, sessionId);
    const oldMemberRef = doc(this.firestore, SESSIONS_COLLECTION, sessionId, 'members', previousModeratorUid);
    const newMemberRef = doc(this.firestore, SESSIONS_COLLECTION, sessionId, 'members', newModeratorUid);
    const newSnap = await getDoc(newMemberRef);
    if (!newSnap.exists()) {
      throw new Error('TRANSFER_INVALID_MEMBER');
    }
    const batch = writeBatch(this.firestore);
    batch.update(sessionRef, {
      moderatorId: newModeratorUid,
      updatedAt: serverTimestamp(),
    });
    batch.update(oldMemberRef, {
      role: 'participant',
      updatedAt: serverTimestamp(),
    });
    batch.update(newMemberRef, {
      role: 'moderator',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  }

  private async commitDeleteSessionMember(sessionId: string, memberId: string): Promise<void> {
    if (!sessionId || !memberId) {
      return;
    }
    const ref = doc(this.firestore, SESSIONS_COLLECTION, sessionId, 'members', memberId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error('TRANSFER_INVALID_MEMBER');
    }
    await deleteDoc(ref);
  }
}
