import { Session, Story } from '@app/core/models';

/** Binds the active vote query: same key → same Firestore listener can stay open. */
export function voteRoundCoordinationKey(session: Session | null): string {
  if (!session) {
    return '';
  }
  const aid = session.activeStoryId ?? '';
  return `${aid}\u0000${session.revealState.roundEpoch}`;
}

/** When this is unchanged, inactive per-story vote listeners stay subscribed. */
export function inactiveVotesCoordinationKey(session: Session | null, stories: Story[]): string {
  const active = session?.activeStoryId ?? '';
  const ids = stories
    .map((s) => s.id)
    .sort()
    .join(',');
  return `${active}\u0000${ids}`;
}
