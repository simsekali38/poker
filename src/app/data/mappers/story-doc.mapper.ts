import { DocumentData, DocumentSnapshot, Timestamp } from 'firebase/firestore';
import { Story, StoryStatus } from '@app/core/models';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return new Date(0);
}

function asStoryStatus(value: unknown): StoryStatus {
  if (value === 'draft' || value === 'active' || value === 'completed' || value === 'skipped') {
    return value;
  }
  return 'active';
}

export function mapStoryDocument(storyId: string, sessionId: string, data: DocumentData): Story | null {
  const createdBy = typeof data['createdBy'] === 'string' ? data['createdBy'] : '';
  if (!createdBy) {
    return null;
  }
  return {
    id: storyId,
    sessionId,
    title: typeof data['title'] === 'string' ? data['title'] : '',
    description: typeof data['description'] === 'string' ? data['description'] : '',
    status: asStoryStatus(data['status']),
    createdBy,
    createdAt: toDate(data['createdAt']),
    updatedAt: toDate(data['updatedAt']),
  };
}

export function mapStorySnapshot(sessionId: string, snapshot: DocumentSnapshot): Story | null {
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data();
  if (!data) {
    return null;
  }
  return mapStoryDocument(snapshot.id, sessionId, data);
}
