import { DocumentData, DocumentSnapshot, Timestamp } from 'firebase/firestore';
import {
  DeckPresetId,
  DEFAULT_ROUND_TIMER_DURATION_SEC,
  RevealState,
  RoundTimerState,
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

function mapRoundTimer(raw: unknown): RoundTimerState {
  if (!raw || typeof raw !== 'object') {
    return {
      durationSec: DEFAULT_ROUND_TIMER_DURATION_SEC,
      isRunning: false,
      startedAt: null,
    };
  }
  const o = raw as Record<string, unknown>;
  const d = typeof o['durationSec'] === 'number' ? o['durationSec'] : DEFAULT_ROUND_TIMER_DURATION_SEC;
  const durationSec = Math.min(3600, Math.max(10, Math.round(d)));
  return {
    durationSec,
    isRunning: Boolean(o['isRunning']),
    startedAt: o['startedAt'] ? toDate(o['startedAt']) : null,
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
  const jira = o['jiraIntegrationEnabled'];
  const site = o['jiraSiteUrl'];
  const conn = o['jiraConnected'];
  const board = o['jiraBoardId'];
  return {
    deckPresetId,
    cards: cards as VoteCard[],
    allowVoteChangesBeforeReveal: Boolean(o['allowVoteChangesBeforeReveal']),
    /** Default on when field missing (legacy sessions). */
    autoRevealWhenAllVoted: o['autoRevealWhenAllVoted'] !== false,
    ...(jira === true || jira === false ? { jiraIntegrationEnabled: jira } : {}),
    ...(typeof site === 'string' ? { jiraSiteUrl: site } : {}),
    ...(conn === true || conn === false ? { jiraConnected: conn } : {}),
    ...(typeof board === 'string' ? { jiraBoardId: board } : {}),
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
    roundTimer: mapRoundTimer(data['roundTimer']),
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
