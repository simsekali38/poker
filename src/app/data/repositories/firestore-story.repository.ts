import { Injectable, inject } from '@angular/core';
import {
  DocumentData,
  Firestore,
  UpdateData,
  collection,
  collectionData,
  doc,
  docData,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, defer, from, map, of } from 'rxjs';
import { Story } from '@app/core/models';
import { SESSIONS_COLLECTION } from '@app/data/firebase/firestore-paths';
import { mapStoryDocument, mapStorySnapshot } from '@app/data/mappers/story-doc.mapper';
import { generateEntityId } from '@app/shared/utils/id.utils';
import {
  CreateSessionStoryParams,
  StoryRepository,
  UpdateStoryPatch,
} from './story.repository';

@Injectable({ providedIn: 'root' })
export class FirestoreStoryRepository implements StoryRepository {
  private readonly firestore = inject(Firestore);

  watchStory(sessionId: string, storyId: string): Observable<Story | null> {
    const sid = sessionId.trim();
    const stid = storyId.trim();
    if (!sid || !stid) {
      return of(null);
    }
    const ref = doc(this.firestore, SESSIONS_COLLECTION, sid, 'stories', stid);
    return docData(ref).pipe(
      map((data) => (data ? mapStoryDocument(stid, sid, data as DocumentData) : null)),
    );
  }

  getStoryOnce(sessionId: string, storyId: string): Observable<Story | null> {
    const sid = sessionId.trim();
    const stid = storyId.trim();
    if (!sid || !stid) {
      return of(null);
    }
    const ref = doc(this.firestore, SESSIONS_COLLECTION, sid, 'stories', stid);
    return defer(() => from(getDoc(ref))).pipe(map((snap) => mapStorySnapshot(sid, snap)));
  }

  watchStories(sessionId: string): Observable<Story[]> {
    const sid = sessionId.trim();
    if (!sid) {
      return of([]);
    }
    const col = collection(this.firestore, SESSIONS_COLLECTION, sid, 'stories');
    const q = query(col, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }).pipe(
      map((rows) => {
        const list = rows as Array<Record<string, unknown> & { id?: string }>;
        return list
          .map((r) => mapStoryDocument(String(r['id'] ?? ''), sid, r as DocumentData))
          .filter((s): s is Story => s !== null);
      }),
    );
  }

  createStory(sessionId: string, params: CreateSessionStoryParams): Observable<string> {
    return defer(() => from(this.commitCreateStory(sessionId.trim(), params)));
  }

  updateStory(sessionId: string, storyId: string, patch: UpdateStoryPatch): Observable<void> {
    return defer(() => from(this.commitUpdateStory(sessionId.trim(), storyId.trim(), patch)));
  }

  private async commitCreateStory(sessionId: string, params: CreateSessionStoryParams): Promise<string> {
    const title = params.title.trim();
    if (!title) {
      throw new Error('Story title is required');
    }
    const description = params.description.trim();
    const storyId = generateEntityId();
    const storyRef = doc(this.firestore, SESSIONS_COLLECTION, sessionId, 'stories', storyId);
    const batch = writeBatch(this.firestore);

    const status = params.makeActive ? 'active' : 'draft';
    batch.set(storyRef, {
      title,
      description,
      status,
      createdBy: params.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.makeActive) {
      const sessionRef = doc(this.firestore, SESSIONS_COLLECTION, sessionId);
      const revealState = {
        storyId,
        roundEpoch: 1,
        revealed: false,
        revealedAt: null,
        revealedByMemberId: null,
      };
      batch.update(sessionRef, {
        activeStoryId: storyId,
        revealState,
        updatedAt: serverTimestamp(),
      });
      if (params.previousActiveStoryId && params.previousActiveStoryId !== storyId) {
        const prevRef = doc(
          this.firestore,
          SESSIONS_COLLECTION,
          sessionId,
          'stories',
          params.previousActiveStoryId,
        );
        batch.update(prevRef, { status: 'completed', updatedAt: serverTimestamp() });
      }
    }

    await batch.commit();
    return storyId;
  }

  private async commitUpdateStory(
    sessionId: string,
    storyId: string,
    patch: UpdateStoryPatch,
  ): Promise<void> {
    if (!storyId) {
      return;
    }
    const payload: UpdateData<DocumentData> = { updatedAt: serverTimestamp() };
    if (patch.title !== undefined) {
      payload['title'] = patch.title.trim();
    }
    if (patch.description !== undefined) {
      payload['description'] = patch.description.trim();
    }
    if (patch.status !== undefined) {
      payload['status'] = patch.status;
    }
    const ref = doc(this.firestore, SESSIONS_COLLECTION, sessionId, 'stories', storyId);
    await updateDoc(ref, payload);
  }
}
