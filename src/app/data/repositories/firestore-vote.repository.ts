import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  collection,
  collectionData,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, defer, from, map, of } from 'rxjs';
import { Vote } from '@app/core/models';
import { SESSIONS_COLLECTION } from '@app/data/firebase/firestore-paths';
import { voteDocumentId } from '@app/data/firebase/vote-doc-id';
import { mapVoteDocument } from '@app/data/mappers/vote-doc.mapper';
import { SubmitVoteParams, VoteRepository } from './vote.repository';

@Injectable({ providedIn: 'root' })
export class FirestoreVoteRepository implements VoteRepository {
  private readonly firestore = inject(Firestore);

  watchVotesForRound(
    sessionId: string,
    storyId: string,
    roundEpoch: number,
  ): Observable<Vote[]> {
    const sid = sessionId.trim();
    const stid = storyId.trim();
    if (!sid || !stid) {
      return of([]);
    }
    const col = collection(this.firestore, SESSIONS_COLLECTION, sid, 'votes');
    const q = query(col, where('storyId', '==', stid), where('roundEpoch', '==', roundEpoch));
    return collectionData(q, { idField: 'id' }).pipe(
      map((rows) => {
        const list = rows as Array<Record<string, unknown> & { id?: string }>;
        return list
          .map((r) => mapVoteDocument(String(r['id'] ?? ''), r as DocumentData))
          .filter((v): v is Vote => v !== null);
      }),
    );
  }

  watchVotesLatestEpochForStory(sessionId: string, storyId: string): Observable<Vote[]> {
    const sid = sessionId.trim();
    const stid = storyId.trim();
    if (!sid || !stid) {
      return of([]);
    }
    const col = collection(this.firestore, SESSIONS_COLLECTION, sid, 'votes');
    const q = query(col, where('storyId', '==', stid));
    return collectionData(q, { idField: 'id' }).pipe(
      map((rows) => {
        const list = rows as Array<Record<string, unknown> & { id?: string }>;
        const votes = list
          .map((r) => mapVoteDocument(String(r['id'] ?? ''), r as DocumentData))
          .filter((v): v is Vote => v !== null);
        if (!votes.length) {
          return [];
        }
        const epoch = Math.max(...votes.map((v) => v.roundEpoch));
        return votes.filter((v) => v.roundEpoch === epoch);
      }),
    );
  }

  submitVote(params: SubmitVoteParams): Observable<void> {
    return defer(() => from(this.commitSubmitVote(params)));
  }

  deleteVotesForStoryRound(
    sessionId: string,
    storyId: string,
    roundEpoch: number,
  ): Observable<void> {
    return defer(() => from(this.commitDeleteVotesForRound(sessionId, storyId, roundEpoch)));
  }

  deleteAllVotesForMember(sessionId: string, memberId: string): Observable<void> {
    return defer(() => from(this.commitDeleteAllVotesForMember(sessionId, memberId)));
  }

  private async commitDeleteAllVotesForMember(sessionId: string, memberId: string): Promise<void> {
    const sid = sessionId.trim();
    const mid = memberId.trim();
    if (!sid || !mid) {
      return;
    }
    const col = collection(this.firestore, SESSIONS_COLLECTION, sid, 'votes');
    const q = query(col, where('memberId', '==', mid));
    const snap = await getDocs(q);
    const refs = snap.docs.map((d) => d.ref);
    const maxBatch = 500;
    let batch = writeBatch(this.firestore);
    let opCount = 0;
    for (const ref of refs) {
      batch.delete(ref);
      opCount++;
      if (opCount >= maxBatch) {
        await batch.commit();
        batch = writeBatch(this.firestore);
        opCount = 0;
      }
    }
    if (opCount > 0) {
      await batch.commit();
    }
  }

  private async commitDeleteVotesForRound(
    sessionId: string,
    storyId: string,
    roundEpoch: number,
  ): Promise<void> {
    const sid = sessionId.trim();
    const stid = storyId.trim();
    if (!sid || !stid) {
      return;
    }
    const col = collection(this.firestore, SESSIONS_COLLECTION, sid, 'votes');
    const q = query(col, where('storyId', '==', stid), where('roundEpoch', '==', roundEpoch));
    const snap = await getDocs(q);
    const refs = snap.docs.map((d) => d.ref);
    const maxBatch = 500;
    let batch = writeBatch(this.firestore);
    let opCount = 0;
    for (const ref of refs) {
      batch.delete(ref);
      opCount++;
      if (opCount >= maxBatch) {
        await batch.commit();
        batch = writeBatch(this.firestore);
        opCount = 0;
      }
    }
    if (opCount > 0) {
      await batch.commit();
    }
  }

  private async commitSubmitVote(p: SubmitVoteParams): Promise<void> {
    const sessionId = p.sessionId.trim();
    const storyId = p.storyId.trim();
    const id = voteDocumentId(p.memberId, storyId, p.roundEpoch);
    const ref = doc(this.firestore, SESSIONS_COLLECTION, sessionId, 'votes', id);
    await setDoc(ref, {
      sessionId,
      storyId,
      memberId: p.memberId,
      selectedCard: p.selectedCard,
      roundEpoch: p.roundEpoch,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
