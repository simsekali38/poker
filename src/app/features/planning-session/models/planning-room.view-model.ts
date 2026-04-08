import { RoundTimerState, SessionStatus, Story, VoteCard } from '@app/core/models';
import type { FinalEstimateDecisionVm } from '../view/final-estimate-vm.builder';

export interface ParticipantRowVm {
  memberId: string;
  displayName: string;
  isModerator: boolean;
  isLocalUser: boolean;
  isOnline: boolean;
  hasVoted: boolean;
  /** True when this member has voted but value must stay hidden (not self, not revealed). */
  voteMasked: boolean;
  /** Shown when revealed, or for the local user before reveal. */
  cardLabel: VoteCard | null;
}

export interface ResultRowVm {
  memberId: string;
  displayName: string;
  card: VoteCard;
}

export interface StoryHistoryRowVm {
  id: string;
  title: string;
  isActive: boolean;
  createdAtMs: number;
  /** Latest epoch vote count for this story (inactive rows use preserved Firestore votes). */
  historyVoteCount: number;
  /** Numeric average for `historyVoteCount` votes when all are visible to history (always for past stories). */
  historyNumericAverage: number | null;
}

/** Strongly typed snapshot for the planning room UI. */
export interface PlanningRoomViewModel {
  sessionId: string;
  /** e.g. `AB12-CD34` for an 8-char code — display only; URLs use `sessionId`. */
  sessionCodeDisplay: string;
  sessionTitle: string;
  sessionStatus: SessionStatus;
  moderatorId: string;
  localMemberId: string | null;
  isModerator: boolean;
  votesRevealed: boolean;
  activeStoryId: string | null;
  roundEpoch: number;
  deck: readonly VoteCard[];
  story: Story | null;
  /** Newest first; includes active + backlog/completed for moderator navigation. */
  storyHistoryRows: StoryHistoryRowVm[];
  canEditActiveStory: boolean;
  canManageStories: boolean;
  canVote: boolean;
  participants: ParticipantRowVm[];
  results: ResultRowVm[];
  numericAverage: number | null;
  votedCount: number;
  participantCount: number;
  /** Local user's current card for this round, if any. */
  localVote: VoteCard | null;

  /** Moderator may reveal (hidden → visible for all). */
  canReveal: boolean;
  /** Moderator may reset: clear round votes, hide, bump epoch; members/story unchanged. */
  canResetRound: boolean;

  /** All online members have a vote while the round is hidden (see `everyoneActiveOnlineHasVoted`). */
  everyoneActiveVoted: boolean;

  /** Firestore-backed round timer; remaining seconds are derived in the store with a 1s ticker. */
  roundTimer: RoundTimerState;

  /** Post-reveal moderator-only: consensus / average / manual final estimate + Jira. */
  finalEstimate: FinalEstimateDecisionVm | null;

  /** From session.settings — Jira Cloud site and optional Scrum board. */
  jiraSiteUrl: string | null;
  jiraBoardId: string | null;
}
