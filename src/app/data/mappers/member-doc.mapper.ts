import { DocumentData, DocumentSnapshot, Timestamp } from 'firebase/firestore';
import { SessionMember, SessionMemberRole } from '@app/core/models';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return new Date(0);
}

function asRole(value: unknown): SessionMemberRole {
  return value === 'moderator' ? 'moderator' : 'participant';
}

export function mapMemberDocument(
  sessionId: string,
  memberId: string,
  data: DocumentData,
): SessionMember | null {
  const displayName = typeof data['displayName'] === 'string' ? data['displayName'] : '';
  if (!displayName) {
    return null;
  }
  return {
    id: memberId,
    sessionId,
    displayName,
    role: asRole(data['role']),
    joinedAt: toDate(data['joinedAt']),
    isOnline: Boolean(data['isOnline']),
    lastSeenAt: toDate(data['lastSeenAt']),
    updatedAt: toDate(data['updatedAt']),
  };
}

export function mapMemberSnapshot(sessionId: string, snapshot: DocumentSnapshot): SessionMember | null {
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data();
  if (!data) {
    return null;
  }
  return mapMemberDocument(sessionId, snapshot.id, data);
}
