import { randomBytes } from 'node:crypto';

export interface OAuthStartState {
  firebaseUid: string;
  returnUrl: string;
  createdAtMs: number;
}

/** In-memory OAuth state. Replace with Redis for multi-instance deployments. */
const store = new Map<string, OAuthStartState>();

const TTL_MS = 15 * 60 * 1000;

function sweep(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now - v.createdAtMs > TTL_MS) {
      store.delete(k);
    }
  }
}

export function createOAuthState(data: Omit<OAuthStartState, 'createdAtMs'>): string {
  sweep();
  const id = randomBytes(24).toString('base64url');
  store.set(id, { ...data, createdAtMs: Date.now() });
  return id;
}

export function consumeOAuthState(id: string): OAuthStartState | null {
  sweep();
  const v = store.get(id);
  if (!v) {
    return null;
  }
  if (Date.now() - v.createdAtMs > TTL_MS) {
    store.delete(id);
    return null;
  }
  store.delete(id);
  return v;
}
