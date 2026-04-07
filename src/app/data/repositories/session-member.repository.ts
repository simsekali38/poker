import { Observable } from 'rxjs';
import { SessionMember } from '@app/core/models';

export interface UpsertMemberOnJoinParams {
  sessionId: string;
  memberUid: string;
  displayName: string;
  /** Session document `moderatorId`; role is always derived from this (single moderator). */
  sessionModeratorUid: string;
}

export interface SessionMemberRepository {
  /** Realtime stream of all members in the session. */
  watchMembers(sessionId: string): Observable<SessionMember[]>;

  /**
   * Creates or updates the caller's member doc. Preserves `joinedAt` on existing docs.
   * Rules should enforce `request.auth.uid == memberUid`.
   */
  upsertMemberOnJoin(params: UpsertMemberOnJoinParams): Observable<void>;
}
