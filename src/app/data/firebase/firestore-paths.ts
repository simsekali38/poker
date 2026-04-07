/** Root collection for session documents (adjust to match security rules). */
export const SESSIONS_COLLECTION = 'planning_poker_sessions';

export const membersCollection = (sessionId: string): string =>
  `${SESSIONS_COLLECTION}/${sessionId}/members`;

export const storiesCollection = (sessionId: string): string =>
  `${SESSIONS_COLLECTION}/${sessionId}/stories`;

export const votesCollection = (sessionId: string): string =>
  `${SESSIONS_COLLECTION}/${sessionId}/votes`;

export const auditCollection = (sessionId: string): string =>
  `${SESSIONS_COLLECTION}/${sessionId}/audit`;
