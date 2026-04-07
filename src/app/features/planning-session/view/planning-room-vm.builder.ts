import { Session, SessionMember, Story, Vote } from '@app/core/models';
import { formatSessionCodeForDisplay } from '@app/shared/utils/session-code.utils';
import { averageNumericVotes } from '@app/shared/utils/voting.utils';
import {
  ParticipantRowVm,
  PlanningRoomViewModel,
  ResultRowVm,
  StoryHistoryRowVm,
} from '../models/planning-room.view-model';

export interface SessionRoomPayload {
  session: Session | null;
  members: SessionMember[];
  votes: Vote[];
  allStories: Story[];
  /** Latest-epoch votes per story id for stories that are not the active voting target. */
  inactiveStoryLatestVotes: ReadonlyMap<string, Vote[]>;
}

export function buildPlanningRoomViewModel(
  payload: SessionRoomPayload,
  authUid: string | null,
): PlanningRoomViewModel | null {
  const { session, members, votes, allStories, inactiveStoryLatestVotes } = payload;
  if (!session) {
    return null;
  }

  const activeStoryId = session.activeStoryId;
  const story: Story | null =
    activeStoryId === null ? null : (allStories.find((s) => s.id === activeStoryId) ?? null);

  const revealed = session.revealState.revealed;
  const voteByMember = new Map(votes.map((v) => [v.memberId, v]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  const participants: ParticipantRowVm[] = members.map((m) => {
    const vote = voteByMember.get(m.id);
    const hasVoted = !!vote;
    /** Card values in the participant list only after reveal (deck still uses `localVote`). */
    const showCardInList = revealed && hasVoted && vote;
    return {
      memberId: m.id,
      displayName: m.displayName,
      isModerator: m.id === session.moderatorId,
      isLocalUser: m.id === authUid,
      isOnline: m.isOnline,
      hasVoted,
      voteMasked: hasVoted && !revealed,
      cardLabel: showCardInList ? vote.selectedCard : null,
    };
  });

  const results: ResultRowVm[] = revealed
    ? votes
        .map((v) => {
          const name = memberById.get(v.memberId)?.displayName ?? v.memberId;
          return { memberId: v.memberId, displayName: name, card: v.selectedCard };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
    : [];

  const numericAverage = revealed ? averageNumericVotes(votes) : null;
  const votedCount = votes.length;
  const localVote = authUid ? voteByMember.get(authUid)?.selectedCard ?? null : null;

  const hasStory = !!session.activeStoryId;
  const canVote =
    !!authUid && hasStory && !revealed && session.status === 'active';

  const isModerator = !!authUid && authUid === session.moderatorId;
  const canReveal =
    isModerator &&
    session.status === 'active' &&
    hasStory &&
    !revealed;
  const canResetRound = isModerator && session.status === 'active' && hasStory;
  const canManageStories = isModerator && session.status === 'active';
  const canEditActiveStory = canManageStories && hasStory;

  const storyHistoryRows: StoryHistoryRowVm[] = allStories.map((s) => {
    const isActive = session.activeStoryId === s.id;
    const slice = isActive ? votes : (inactiveStoryLatestVotes.get(s.id) ?? []);
    const historyVoteCount = slice.length;
    const historyNumericAverage =
      historyVoteCount > 0 && (!isActive || revealed) ? averageNumericVotes(slice) : null;
    return {
      id: s.id,
      title: s.title || 'Untitled story',
      isActive,
      createdAtMs: s.createdAt.getTime(),
      historyVoteCount,
      historyNumericAverage,
    };
  });

  return {
    sessionId: session.id,
    sessionCodeDisplay: formatSessionCodeForDisplay(session.id),
    sessionTitle: session.title,
    sessionStatus: session.status,
    moderatorId: session.moderatorId,
    localMemberId: authUid,
    isModerator,
    votesRevealed: revealed,
    activeStoryId: session.activeStoryId,
    roundEpoch: session.revealState.roundEpoch,
    deck: session.settings.cards,
    story,
    storyHistoryRows,
    canEditActiveStory,
    canManageStories,
    canVote,
    participants,
    results,
    numericAverage,
    votedCount,
    participantCount: members.length,
    localVote,
    canReveal,
    canResetRound,
  };
}
