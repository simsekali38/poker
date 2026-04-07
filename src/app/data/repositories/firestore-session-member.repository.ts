import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { Observable, defer, from, map, of } from 'rxjs';
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
    return collectionData(col, { idField: 'id' }).pipe(
      map((rows) => {
        const list = rows as Array<Record<string, unknown> & { id?: string }>;
        return list
          .map((r) => mapMemberDocument(id, String(r['id'] ?? ''), r as DocumentData))
          .filter((m): m is SessionMember => m !== null)
          .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
      }),
    );
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
