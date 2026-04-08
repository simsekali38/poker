import { DocumentData, DocumentSnapshot, Timestamp } from 'firebase/firestore';
import { FinalEstimateMethod, Story, StoryStatus, VoteCard } from '@app/core/models';

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

function asFinalEstimateMethod(value: unknown): FinalEstimateMethod | null {
  if (value === 'consensus' || value === 'rounded_average' || value === 'moderator_pick') {
    return value;
  }
  return null;
}

function asVoteCard(value: unknown): VoteCard | null {
  return typeof value === 'string' ? (value as VoteCard) : null;
}

export function mapStoryDocument(storyId: string, sessionId: string, data: DocumentData): Story | null {
  const createdBy = typeof data['createdBy'] === 'string' ? data['createdBy'] : '';
  if (!createdBy) {
    return null;
  }
  const jiraAt = data['jiraSyncedAt'];
  return {
    id: storyId,
    sessionId,
    title: typeof data['title'] === 'string' ? data['title'] : '',
    description: typeof data['description'] === 'string' ? data['description'] : '',
    status: asStoryStatus(data['status']),
    createdBy,
    createdAt: toDate(data['createdAt']),
    updatedAt: toDate(data['updatedAt']),
    finalEstimateMethod: asFinalEstimateMethod(data['finalEstimateMethod']),
    finalEstimateCard: asVoteCard(data['finalEstimateCard']),
    jiraSyncedAt: jiraAt ? toDate(jiraAt) : null,
    jiraIssueKey: typeof data['jiraIssueKey'] === 'string' ? data['jiraIssueKey'] : null,
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
