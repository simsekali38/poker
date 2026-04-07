import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, authState } from '@angular/fire/auth';
import { ActivatedRoute } from '@angular/router';
import { Vote, VoteCard } from '@app/core/models';
import { SessionModerationService } from '@app/core/services/session-moderation.service';
import { isFirebasePermissionDenied } from '@app/core/utils/firebase-error.utils';
import { isSessionModerationError } from '@app/core/utils/session-moderation-error.utils';
import {
  combineLatest,
  concat,
  distinctUntilChanged,
  filter,
  interval,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  take,
  finalize,
} from 'rxjs';
import {
  SESSION_MEMBER_REPOSITORY,
  SESSION_REPOSITORY,
  STORY_REPOSITORY,
  VOTE_REPOSITORY,
} from '@app/core/tokens/repository.tokens';
import { PlanningRoomViewModel } from '../models/planning-room.view-model';
import {
  SessionRoomPayload,
  buildPlanningRoomViewModel,
} from '../view/planning-room-vm.builder';
import {
  inactiveVotesCoordinationKey,
  voteRoundCoordinationKey,
} from './planning-room-stream.utils';
import { roundTimerRemainingSec as computeRoundTimerRemaining } from '@app/shared/utils/round-timer-remaining.util';

type RoomStreamState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ready'; payload: SessionRoomPayload };

export type PlanningRoomPhase = 'loading' | 'missing' | 'ready';

@Injectable()
export class PlanningSessionStore {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(Auth);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly members = inject(SESSION_MEMBER_REPOSITORY);
  private readonly stories = inject(STORY_REPOSITORY);
  private readonly votes = inject(VOTE_REPOSITORY);
  private readonly moderation = inject(SessionModerationService);

  readonly actionError = signal<string | null>(null);
  readonly moderationBusy = signal(false);
  readonly storyActionBusy = signal(false);
  readonly voteSubmitBusy = signal(false);
  readonly timerBusy = signal(false);

  /** Ticks once per second so `roundTimerRemainingSec` stays current while the room is open. */
  private readonly timerClock = toSignal(interval(1000).pipe(startWith(0)), { initialValue: 0 });

  /** Remaining seconds while `roundTimer.isRunning`; `null` when stopped. */
  readonly roundTimerRemainingSec = computed(() => {
    this.timerClock();
    const vm = this.roomView();
    if (!vm) {
      return null;
    }
    return computeRoundTimerRemaining(vm.roundTimer, Date.now());
  });

  /** Single shared param stream — avoids duplicate `ActivatedRoute` subscriptions. */
  private readonly sessionId$ = this.route.paramMap.pipe(
    map((p) => p.get('sessionId')?.trim() ?? ''),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly sessionId = toSignal(
    this.sessionId$.pipe(map((id) => (id.length > 0 ? id : null))),
    { initialValue: null },
  );

  private readonly sessionIdNonEmpty$ = this.sessionId$.pipe(
    filter((id): id is string => id.length > 0),
  );

  private readonly authUid$ = authState(this.auth).pipe(map((u) => u?.uid ?? null));

  /**
   * One Firestore listener per session doc (`shareReplay`), merged with members/stories.
   * Active-round votes only re-subscribe when `activeStoryId` or `roundEpoch` changes.
   * Inactive-story vote queries only re-subscribe when active story or story id set changes.
   */
  private readonly roomState$ = this.sessionIdNonEmpty$.pipe(
    switchMap((sessionId) => {
      const sessionSnap$ = this.sessions.watchSession(sessionId).pipe(
        shareReplay({ bufferSize: 1, refCount: true }),
      );

      const activeVotes$ = sessionSnap$.pipe(
        distinctUntilChanged(
          (a, b) => voteRoundCoordinationKey(a) === voteRoundCoordinationKey(b),
        ),
        switchMap((s) => {
          if (!s?.activeStoryId) {
            return of<Vote[]>([]);
          }
          return this.votes.watchVotesForRound(sessionId, s.activeStoryId, s.revealState.roundEpoch);
        }),
      );

      const inactiveVotes$ = combineLatest([
        sessionSnap$,
        this.stories.watchStories(sessionId),
      ]).pipe(
        distinctUntilChanged(
          (a, b) =>
            inactiveVotesCoordinationKey(a[0], a[1]) ===
            inactiveVotesCoordinationKey(b[0], b[1]),
        ),
        switchMap(([s, storyList]) => {
          const activeId = s?.activeStoryId ?? null;
          const ids = storyList
            .filter((st) => !activeId || st.id !== activeId)
            .map((st) => st.id);
          if (ids.length === 0) {
            return of(new Map<string, Vote[]>());
          }
          return combineLatest(
            ids.map((id) =>
              this.votes.watchVotesLatestEpochForStory(sessionId, id).pipe(
                map((v) => [id, v] as const),
              ),
            ),
          ).pipe(map((pairs) => new Map(pairs)));
        }),
      );

      const ready$ = combineLatest({
        session: sessionSnap$,
        members: this.members.watchMembers(sessionId),
        allStories: this.stories.watchStories(sessionId),
        votes: activeVotes$,
        inactiveStoryLatestVotes: inactiveVotes$,
      }).pipe(
        map(
          ({ session, members, allStories, votes, inactiveStoryLatestVotes }): RoomStreamState => {
            if (session === null) {
              return { kind: 'missing' };
            }
            return {
              kind: 'ready',
              payload: {
                session,
                members,
                votes,
                allStories,
                inactiveStoryLatestVotes,
              },
            };
          },
        ),
      );

      return concat(of<RoomStreamState>({ kind: 'loading' }), ready$);
    }),
  );

  private readonly planningRoom = toSignal(
    combineLatest([this.roomState$, this.authUid$]).pipe(
      map(([state, uid]): { phase: PlanningRoomPhase; view: PlanningRoomViewModel | null } => {
        if (state.kind === 'loading') {
          return { phase: 'loading', view: null };
        }
        if (state.kind === 'missing') {
          return { phase: 'missing', view: null };
        }
        return {
          phase: 'ready',
          view: buildPlanningRoomViewModel(state.payload, uid),
        };
      }),
    ),
    { initialValue: { phase: 'loading' as PlanningRoomPhase, view: null as PlanningRoomViewModel | null } },
  );

  readonly roomPhase = computed<PlanningRoomPhase>(() => this.planningRoom().phase);
  readonly roomView = computed(() => this.planningRoom().view);

  dismissActionError(): void {
    this.actionError.set(null);
  }

  pickVote(card: VoteCard): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    this.actionError.set(null);
    if (!vm?.canVote || !uid || !sid || !vm.activeStoryId || this.voteSubmitBusy()) {
      return;
    }
    this.voteSubmitBusy.set(true);
    this.votes
      .submitVote({
        sessionId: sid,
        storyId: vm.activeStoryId,
        memberId: uid,
        roundEpoch: vm.roundEpoch,
        selectedCard: card,
      })
      .pipe(
        take(1),
        finalize(() => this.voteSubmitBusy.set(false)),
      )
      .subscribe({
        error: () =>
          this.actionError.set('Could not save your vote. Check your connection and permissions.'),
      });
  }

  reveal(): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!vm?.canReveal || !uid || !sid || this.moderationBusy()) {
      return;
    }
    this.actionError.set(null);
    this.moderationBusy.set(true);
    this.moderation
      .revealVotes(sid, uid)
      .pipe(
        take(1),
        finalize(() => this.moderationBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  resetRound(): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!vm?.canResetRound || !uid || !sid || this.moderationBusy()) {
      return;
    }
    this.actionError.set(null);
    this.moderationBusy.set(true);
    this.moderation
      .resetVotingRound(sid, uid)
      .pipe(
        take(1),
        finalize(() => this.moderationBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  startRoundTimer(): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!vm?.isModerator || !uid || !sid || this.timerBusy()) {
      return;
    }
    this.actionError.set(null);
    this.timerBusy.set(true);
    this.moderation
      .startRoundTimer(sid, uid)
      .pipe(
        take(1),
        finalize(() => this.timerBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  stopRoundTimer(): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!vm?.isModerator || !uid || !sid || this.timerBusy()) {
      return;
    }
    this.actionError.set(null);
    this.timerBusy.set(true);
    this.moderation
      .stopRoundTimer(sid, uid)
      .pipe(
        take(1),
        finalize(() => this.timerBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  resetRoundTimer(): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!vm?.isModerator || !uid || !sid || this.timerBusy()) {
      return;
    }
    this.actionError.set(null);
    this.timerBusy.set(true);
    this.moderation
      .resetRoundTimer(sid, uid, true)
      .pipe(
        take(1),
        finalize(() => this.timerBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  setRoundTimerDuration(durationSec: number): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!vm?.isModerator || !uid || !sid || this.timerBusy()) {
      return;
    }
    this.actionError.set(null);
    this.timerBusy.set(true);
    this.moderation
      .setRoundTimerDuration(sid, uid, durationSec)
      .pipe(
        take(1),
        finalize(() => this.timerBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  createStory(title: string, description: string, makeActive: boolean): void {
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!uid || !sid || this.storyActionBusy()) {
      return;
    }
    const vm = this.roomView();
    if (!vm?.canManageStories) {
      return;
    }
    this.actionError.set(null);
    this.storyActionBusy.set(true);
    this.moderation
      .createStory(sid, uid, { title, description, makeActive })
      .pipe(
        take(1),
        finalize(() => this.storyActionBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  updateActiveStoryDetails(title: string, description: string): void {
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!uid || !sid || this.storyActionBusy()) {
      return;
    }
    const vm = this.roomView();
    if (!vm?.canEditActiveStory) {
      return;
    }
    this.actionError.set(null);
    this.storyActionBusy.set(true);
    this.moderation
      .updateActiveStory(sid, uid, { title, description })
      .pipe(
        take(1),
        finalize(() => this.storyActionBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  switchActiveStory(storyId: string): void {
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!uid || !sid || this.storyActionBusy()) {
      return;
    }
    const vm = this.roomView();
    if (!vm?.canManageStories) {
      return;
    }
    this.actionError.set(null);
    this.storyActionBusy.set(true);
    this.moderation
      .switchActiveStory(sid, uid, storyId)
      .pipe(
        take(1),
        finalize(() => this.storyActionBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  private setActionErrorFromUnknown(err: unknown): void {
    if (isSessionModerationError(err)) {
      this.actionError.set(this.moderation.userMessageForFailure(err.moderationCode));
      return;
    }
    if (isFirebasePermissionDenied(err)) {
      this.actionError.set(
        'Permission denied. Check Firestore rules for moderator and member writes.',
      );
      return;
    }
    if (err instanceof Error && err.message === 'Story title is required') {
      this.actionError.set(this.moderation.userMessageForFailure('INVALID_STORY_TITLE'));
      return;
    }
    this.actionError.set('Something went wrong. Please try again.');
  }
}
