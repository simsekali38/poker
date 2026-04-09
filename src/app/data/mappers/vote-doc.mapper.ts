import { DocumentData, DocumentSnapshot, Timestamp } from 'firebase/firestore';
import { Vote, VoteCard } from '@app/core/models';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return new Date(0);
}

/** Firestore may store numeric card values from older clients; normalize to deck strings. */
function normalizeVoteCard(value: unknown): VoteCard | null {
  if (typeof value === 'string' && value.length > 0) {
    return value as VoteCard;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value) as VoteCard;
  }
  return null;
}

export function mapVoteDocument(voteId: string, data: DocumentData): Vote | null {
  const sessionId = typeof data['sessionId'] === 'string' ? data['sessionId'] : '';
  const storyId = typeof data['storyId'] === 'string' ? data['storyId'] : '';
  const memberId = typeof data['memberId'] === 'string' ? data['memberId'] : '';
  const card = normalizeVoteCard(data['selectedCard']);
  if (!sessionId || !storyId || !memberId || !card) {
    return null;
  }
  const roundEpoch = typeof data['roundEpoch'] === 'number' ? data['roundEpoch'] : 0;
  return {
    id: voteId,
    sessionId,
    storyId,
    memberId,
    selectedCard: card as VoteCard,
    submittedAt: toDate(data['submittedAt']),
    roundEpoch,
    updatedAt: toDate(data['updatedAt']),
  };
}

export function mapVoteSnapshot(snapshot: DocumentSnapshot): Vote | null {
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data();
  if (!data) {
    return null;
  }
  return mapVoteDocument(snapshot.id, data);
}
