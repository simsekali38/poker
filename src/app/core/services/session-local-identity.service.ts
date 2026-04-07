import { Injectable } from '@angular/core';

const STORAGE_KEY_PREFIX = 'poker-planning:session:';

/** Persisted client binding so refresh on `/session/:id` survives (with matching Auth uid). */
export interface SessionLocalBinding {
  memberId: string;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class SessionLocalIdentityService {
  private get storage(): Storage | null {
    return typeof globalThis !== 'undefined' && globalThis.localStorage
      ? globalThis.localStorage
      : null;
  }

  private key(sessionId: string): string {
    return `${STORAGE_KEY_PREFIX}${encodeURIComponent(sessionId.trim())}`;
  }

  readBinding(sessionId: string): SessionLocalBinding | null {
    const s = this.storage;
    if (!s) {
      return null;
    }
    try {
      const raw = s.getItem(this.key(sessionId));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      const o = parsed as Record<string, unknown>;
      const memberId = o['memberId'];
      const displayName = o['displayName'];
      if (typeof memberId !== 'string' || typeof displayName !== 'string') {
        return null;
      }
      return { memberId, displayName };
    } catch {
      return null;
    }
  }

  saveBinding(sessionId: string, binding: SessionLocalBinding): void {
    const s = this.storage;
    if (!s) {
      return;
    }
    try {
      s.setItem(this.key(sessionId), JSON.stringify(binding));
    } catch {
      /* quota / private mode — room still works until refresh */
    }
  }

  clearBinding(sessionId: string): void {
    this.storage?.removeItem(this.key(sessionId));
  }
}
