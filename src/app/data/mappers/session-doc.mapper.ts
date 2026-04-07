import { DocumentData, DocumentSnapshot, Timestamp } from 'firebase/firestore';
import {
  DeckPresetId,
  RevealState,
  Session,
  SessionSettings,
  SessionStatus,
  VoteCard,
} from '@app/core/models';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return new Date(0);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asSessionStatus(value: unknown): SessionStatus {
  if (value === 'lobby' || value === 'active' || value === 'archived') {
    return value;
  }
  return 'active';
}

function mapRevealState(raw: unknown): RevealState | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const storyId = o['storyId'];
  return {
    storyId: typeof storyId === 'string' ? storyId : null,
    roundEpoch: typeof o['roundEpoch'] === 'number' ? o['roundEpoch'] : 0,
    revealed: Boolean(o['revealed']),
    revealedAt: o['revealedAt'] ? toDate(o['revealedAt']) : null,
    revealedByMemberId:
      typeof o['revealedByMemberId'] === 'string' ? o['revealedByMemberId'] : null,
  };
}

function mapSettings(raw: unknown): SessionSettings | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const cards = o['cards'];
  if (!Array.isArray(cards) || !cards.every((c) => typeof c === 'string')) {
    return null;
  }
  const deckPresetId = asString(o['deckPresetId'], 'classic') as DeckPresetId;
  return {
    deckPresetId,
    cards: cards as VoteCard[],
    allowVoteChangesBeforeReveal: Boolean(o['allowVoteChangesBeforeReveal']),
    autoRevealWhenAllVoted: o['autoRevealWhenAllVoted'] === true,
  };
}

/** Maps raw Firestore document data + id into `Session`. */
export function mapSessionDocument(docId: string, data: DocumentData): Session | null {
  const settings = mapSettings(data['settings']);
  const revealState = mapRevealState(data['revealState']);
  if (!settings || !revealState) {
    return null;
  }
  const moderatorId = asString(data['moderatorId'], '');
  if (!moderatorId) {
    return null;
  }
  const activeStoryRaw = data['activeStoryId'];
  return {
    id: docId,
    title: asString(data['title'], 'Session'),
    moderatorId,
    createdAt: toDate(data['createdAt']),
    status: asSessionStatus(data['status']),
    settings,
    revealState,
    activeStoryId: typeof activeStoryRaw === 'string' ? activeStoryRaw : null,
    updatedAt: toDate(data['updatedAt']),
  };
}

/** Maps a Firestore session document into the domain `Session` model. */
export function mapSessionSnapshot(snapshot: DocumentSnapshot): Session | null {
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data();
  if (!data) {
    return null;
  }
  return mapSessionDocument(snapshot.id, data);
}
