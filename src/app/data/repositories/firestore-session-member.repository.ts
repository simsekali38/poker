import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { Observable, defer, from, of } from 'rxjs';
import { SessionMember, SessionMemberRole } from '@app/core/models';
import { SESSIONS_COLLECTION } from '@app/data/firebase/firestore-paths';
import { mapMemberDocument } from '@app/data/mappers/member-doc.mapper';
import { SessionMemberRepository, UpsertMemberOnJoinParams } from './session-member.repository';

@Injectable({ providedIn: 'root' })
export class FirestoreSessionMemberRepository implements SessionMemberRepository {
  private readonly firestore = inject(Firestore);

  watchMembers(sessionId: string): Observable<SessionMember[]> {
    const id = sessionId.trim();
    if (!id) {
      return of([]);
    }
    const col = collection(this.firestore, SESSIONS_COLLECTION, id, 'members');
    // Use each snapshot doc's path id — not `collectionData` + `idField: 'id'`, which can
    // mis-associate rows if a stored field named `id` collides with the document id.
    return new Observable<SessionMember[]>((subscriber) => {
      const unsubscribe = onSnapshot(
        col,
        (snap) => {
          const members = snap.docs
            .map((d) => mapMemberDocument(id, d.id, d.data() as DocumentData))
            .filter((m): m is SessionMember => m !== null)
            .sort((a, b) => {
              const byName = a.displayName.localeCompare(b.displayName, undefined, {
                sensitivity: 'base',
              });
              return byName !== 0 ? byName : a.id.localeCompare(b.id);
            });
          subscriber.next(members);
        },
        (err) => subscriber.error(err),
      );
      return () => unsubscribe();
    });
  }

  upsertMemberOnJoin(params: UpsertMemberOnJoinParams): Observable<void> {
    return defer(() => from(this.commitUpsertMember(params)));
  }

  private async commitUpsertMember(params: UpsertMemberOnJoinParams): Promise<void> {
    const ref = doc(
      this.firestore,
      SESSIONS_COLLECTION,
      params.sessionId.trim(),
      'members',
      params.memberUid,
    );
    const snap = await getDoc(ref);
    const role: SessionMemberRole =
      params.memberUid === params.sessionModeratorUid ? 'moderator' : 'participant';
    const base = {
      displayName: params.displayName.trim(),
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isOnline: true,
      role,
    };
    if (!snap.exists()) {
      await setDoc(ref, { ...base, joinedAt: serverTimestamp() });
    } else {
      await setDoc(ref, base, { merge: true });
    }
  }
}
