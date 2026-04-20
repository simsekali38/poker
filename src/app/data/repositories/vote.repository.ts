import { Observable } from 'rxjs';
import { Vote, VoteCard } from '@app/core/models';

export interface SubmitVoteParams {
  sessionId: string;
  storyId: string;
  memberId: string;
  roundEpoch: number;
  selectedCard: VoteCard;
}

export interface VoteRepository {
  watchVotesForRound(
    sessionId: string,
    storyId: string,
    roundEpoch: number,
  ): Observable<Vote[]>;

  /**
   * All votes for a story across rounds; emits the slice for the highest `roundEpoch`
   * present (ties broken by max epoch). Used for history when stories are no longer active.
   */
  watchVotesLatestEpochForStory(sessionId: string, storyId: string): Observable<Vote[]>;

  submitVote(params: SubmitVoteParams): Observable<void>;

  /**
   * Removes all vote docs for the given story + round (e.g. moderator reset).
   * Chunked batches (Firestore 500-op limit).
   */
  deleteVotesForStoryRound(
    sessionId: string,
    storyId: string,
    roundEpoch: number,
  ): Observable<void>;

  /** Deletes every vote doc whose `memberId` matches (e.g. when removing a participant). */
  deleteAllVotesForMember(sessionId: string, memberId: string): Observable<void>;
}
