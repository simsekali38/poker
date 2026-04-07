import { SessionMember, SessionStatus, Vote } from '@app/core/models';

/**
 * True when every **online** member has a vote doc for the current round.
 * - **Offline** members (`isOnline === false`) are excluded from the denominator.
 * - **Abstain** still counts as a submitted vote (that participant is done).
 * - False when there is no active story, session not active, or votes are already revealed.
 *
 * Derived in `buildPlanningRoomViewModel` from the same `members` + `votes` streams as the rest of the room.
 */
export function everyoneActiveOnlineHasVoted(args: {
  members: SessionMember[];
  votes: Vote[];
  sessionStatus: SessionStatus;
  activeStoryId: string | null;
  votesRevealed: boolean;
}): boolean {
  if (args.votesRevealed || args.sessionStatus !== 'active' || !args.activeStoryId) {
    return false;
  }
  const voteByMember = new Map(args.votes.map((v) => [v.memberId, v]));
  const online = args.members.filter((m) => m.isOnline);
  if (online.length === 0) {
    return false;
  }
  return online.every((m) => voteByMember.has(m.id));
}
