import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, authState } from '@angular/fire/auth';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Vote, VoteCard } from '@app/core/models';
import { parseJiraIssueKey } from '@app/shared/utils/jira-issue-key.utils';
import { normalizeJiraSiteUrl } from '@app/shared/utils/jira-site.utils';
import { JiraPlanningIntegrationService } from '@app/core/services/jira-planning-integration.service';
import { SessionModerationService } from '@app/core/services/session-moderation.service';
import { isFirebasePermissionDenied } from '@app/core/utils/firebase-error.utils';
import { isSessionModerationError } from '@app/core/utils/session-moderation-error.utils';
import {
  combineLatest,
  concat,
  distinctUntilChanged,
  filter,
  finalize,
  interval,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  take,
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
import { environment } from '@env/environment';
import { roundTimerRemainingSec as computeRoundTimerRemaining } from '@app/shared/utils/round-timer-remaining.util';

type RoomStreamState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ready'; payload: SessionRoomPayload };

export type PlanningRoomPhase = 'loading' | 'missing' | 'ready';

type PendingLocalVote = {
  card: VoteCard;
  storyId: string;
  roundEpoch: number;
};

@Injectable()
export class PlanningSessionStore {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(Auth);
  private readonly sessions = inject(SESSION_REPOSITORY);
  private readonly members = inject(SESSION_MEMBER_REPOSITORY);
  private readonly stories = inject(STORY_REPOSITORY);
  private readonly votes = inject(VOTE_REPOSITORY);
  private readonly moderation = inject(SessionModerationService);
  private readonly jira = inject(JiraPlanningIntegrationService);

  readonly actionError = signal<string | null>(null);
  readonly moderationBusy = signal(false);
  readonly storyActionBusy = signal(false);
  readonly voteSubmitBusy = signal(false);
  readonly timerBusy = signal(false);
  /** Persisting moderator final-estimate choice (Firestore). */
  readonly finalEstimateBusy = signal(false);
  /** POST to Jira + mark story synced. */
  readonly jiraSubmitBusy = signal(false);
  /** Saving Jira site / issue key on the session or story. */
  readonly jiraMetaBusy = signal(false);
  /** Transient success line after Jira sync. */
  readonly jiraSyncMessage = signal<string | null>(null);

  /**
   * Firestore vote snapshot can lag behind submit; merge so the deck keeps `selected` styling
   * while `voteSubmitBusy` locks interaction.
   */
  private readonly pendingLocalVote = signal<PendingLocalVote | null>(null);

  /**
   * Ticks once per second so `roundTimerRemainingSec` stays current while the room is open.
   * Skipped when the timer UI is disabled in environment (no interval subscription).
   */
  private readonly timerClock = environment.roundTimerUiEnabled
    ? toSignal(interval(1000).pipe(startWith(0)), { initialValue: 0 })
    : signal(0);

  /** Remaining seconds while `roundTimer.isRunning`; `null` when stopped. */
  readonly roundTimerRemainingSec = computed(() => {
    this.timerClock();
    const vm = this.roomView();
    if (!vm || !environment.roundTimerUiEnabled) {
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

  readonly roomView = computed((): PlanningRoomViewModel | null => {
    const base = this.planningRoom().view;
    if (!base) {
      return null;
    }
    const pending = this.pendingLocalVote();
    const pendingActive =
      pending !== null &&
      pending.storyId === base.activeStoryId &&
      pending.roundEpoch === base.roundEpoch;
    const localVote = pendingActive ? pending.card : base.localVote;
    return localVote === base.localVote ? base : { ...base, localVote };
  });

  /** Dedupe auto-reveal attempts per session story round (`sid:storyId:epoch`). */
  private readonly autoRevealAttempted = new Set<string>();
  private prevSessionIdForAutoReveal: string | null = null;

  constructor() {
    effect(() => {
      const base = this.planningRoom().view;
      const pending = this.pendingLocalVote();
      if (!base || !pending) {
        return;
      }
      if (base.activeStoryId !== pending.storyId || base.roundEpoch !== pending.roundEpoch) {
        untracked(() => this.pendingLocalVote.set(null));
        return;
      }
      if (base.localVote === pending.card) {
        untracked(() => this.pendingLocalVote.set(null));
      }
    });

    effect(() => {
      const sid = this.sessionId();
      untracked(() => {
        if (sid !== this.prevSessionIdForAutoReveal) {
          this.prevSessionIdForAutoReveal = sid;
          this.autoRevealAttempted.clear();
        }
      });
    });

    effect(() => {
      const vm = this.roomView();
      const sid = this.sessionId();
      const uid = this.auth.currentUser?.uid;
      if (!vm || !sid || !uid) {
        return;
      }
      if (!vm.autoRevealWhenAllVoted || !vm.isModerator) {
        return;
      }
      if (!vm.everyoneActiveVoted || vm.votesRevealed || !vm.activeStoryId || !vm.canReveal) {
        return;
      }
      if (this.moderationBusy()) {
        return;
      }
      const key = `${sid}:${vm.activeStoryId}:${vm.roundEpoch}`;
      if (this.autoRevealAttempted.has(key)) {
        return;
      }
      this.autoRevealAttempted.add(key);
      untracked(() => {
        this.actionError.set(null);
        this.moderationBusy.set(true);
        this.moderation
          .revealVotes(sid, uid)
          .pipe(
            take(1),
            finalize(() => this.moderationBusy.set(false)),
          )
          .subscribe({
            error: (err: unknown) => {
              this.autoRevealAttempted.delete(key);
              this.setActionErrorFromUnknown(err);
            },
          });
      });
    });
  }

  dismissActionError(): void {
    this.actionError.set(null);
  }

  clearJiraSyncMessage(): void {
    this.jiraSyncMessage.set(null);
  }

  /** Call after OAuth redirect with `jira_site` query param (moderator). */
  applyJiraOAuthReturn(siteFromOAuth: string): void {
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!uid || !sid || this.jiraMetaBusy()) {
      return;
    }
    this.actionError.set(null);
    this.jiraMetaBusy.set(true);
    this.moderation
      .updateSessionJiraSettings(sid, uid, { jiraSiteUrl: siteFromOAuth, jiraConnected: true })
      .pipe(
        take(1),
        finalize(() => this.jiraMetaBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  /** Persist Jira Cloud site URL for this session (moderator). */
  saveSessionJiraSite(rawUrl: string): void {
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!uid || !sid || this.jiraMetaBusy()) {
      return;
    }
    const site = normalizeJiraSiteUrl(rawUrl);
    if (!site) {
      this.actionError.set(this.moderation.userMessageForFailure('INVALID_JIRA_SITE'));
      return;
    }
    this.actionError.set(null);
    this.jiraMetaBusy.set(true);
    this.moderation
      .updateSessionJiraSettings(sid, uid, { jiraSiteUrl: site, jiraConnected: true })
      .pipe(
        take(1),
        finalize(() => this.jiraMetaBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  /** Optional Scrum board id for Jira Agile estimation (`settings.jiraBoardId`). */
  saveSessionJiraBoardId(raw: string): void {
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!uid || !sid || this.jiraMetaBusy()) {
      return;
    }
    this.actionError.set(null);
    this.jiraMetaBusy.set(true);
    this.moderation
      .updateSessionJiraBoardId(sid, uid, raw)
      .pipe(
        take(1),
        finalize(() => this.jiraMetaBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  /** Persist Jira issue key on the active story (moderator). */
  saveActiveStoryJiraIssueKey(raw: string): void {
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!uid || !sid || this.jiraMetaBusy()) {
      return;
    }
    this.actionError.set(null);
    this.jiraMetaBusy.set(true);
    this.moderation
      .setActiveStoryJiraIssueKey(sid, uid, raw)
      .pipe(
        take(1),
        finalize(() => this.jiraMetaBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  selectConsensusFinalEstimate(): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    const fe = vm?.finalEstimate;
    if (!vm?.isModerator || !uid || !sid || !fe?.consensus.available || !fe.consensus.card || this.finalEstimateBusy()) {
      return;
    }
    this.actionError.set(null);
    this.finalEstimateBusy.set(true);
    this.moderation
      .setActiveStoryFinalEstimate(sid, uid, { method: 'consensus', card: fe.consensus.card })
      .pipe(
        take(1),
        finalize(() => this.finalEstimateBusy.set(false)),
      )
      .subscribe({ error: (err: unknown) => this.setActionErrorFromUnknown(err) });
  }

  selectRoundedAverageFinalEstimate(): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    const fe = vm?.finalEstimate;
    const rounded = fe?.average.roundedCard;
    if (!vm?.isModerator || !uid || !sid || !fe?.average.available || !rounded || this.finalEstimateBusy()) {
      return;
    }
    this.actionError.set(null);
    this.finalEstimateBusy.set(true);
    this.moderation
      .setActiveStoryFinalEstimate(sid, uid, { method: 'rounded_average', card: rounded })
      .pipe(
        take(1),
        finalize(() => this.finalEstimateBusy.set(false)),
      )
      .subscribe({ error: (err: unknown) => this.setActionErrorFromUnknown(err) });
  }

  selectModeratorFinalEstimate(card: VoteCard): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!vm?.isModerator || !uid || !sid || this.finalEstimateBusy()) {
      return;
    }
    this.actionError.set(null);
    this.finalEstimateBusy.set(true);
    this.moderation
      .setActiveStoryFinalEstimate(sid, uid, { method: 'moderator_pick', card })
      .pipe(
        take(1),
        finalize(() => this.finalEstimateBusy.set(false)),
      )
      .subscribe({ error: (err: unknown) => this.setActionErrorFromUnknown(err) });
  }

  sendFinalEstimateToJira(): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    const fe = vm?.finalEstimate;
    const story = vm?.story;
    const issueKey = parseJiraIssueKey(story?.jiraIssueKey ?? '');
    if (
      !vm?.isModerator ||
      !uid ||
      !sid ||
      !story ||
      !fe?.canSendToJira ||
      !story.finalEstimateCard ||
      !story.finalEstimateMethod ||
      !issueKey ||
      this.jiraSubmitBusy()
    ) {
      return;
    }
    this.actionError.set(null);
    this.jiraSyncMessage.set(null);
    this.jiraSubmitBusy.set(true);
    this.jira
      .sendFinalEstimate({
        sessionId: sid,
        storyId: story.id,
        storyTitle: story.title,
        estimate: story.finalEstimateCard,
        method: story.finalEstimateMethod,
        jiraIssueKey: issueKey,
        jiraSiteUrl: fe.jiraSiteUrl,
        jiraBoardId: fe.jiraBoardId,
        includeComment: false,
        votes: vm.results.map((r) => ({
          memberId: r.memberId,
          displayName: r.displayName,
          card: r.card,
        })),
        participants: vm.participants.map((p) => ({
          memberId: p.memberId,
          displayName: p.displayName,
        })),
      })
      .pipe(
        switchMap(() => this.moderation.markActiveStoryJiraSynced(sid, uid)),
        take(1),
        finalize(() => this.jiraSubmitBusy.set(false)),
      )
      .subscribe({
        next: () => {
          this.jiraSyncMessage.set('Estimate sent to Jira successfully.');
          globalThis.window?.setTimeout(() => this.jiraSyncMessage.set(null), 8000);
        },
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse) {
            this.actionError.set(
              typeof err.error === 'string' && err.error.length > 0
                ? err.error
                : `Could not send to Jira (${err.status}).`,
            );
            return;
          }
          if (err instanceof Error && err.message === 'Jira integration is not configured') {
            this.actionError.set('Jira integration is not configured.');
            return;
          }
          this.setActionErrorFromUnknown(err);
        },
      });
  }

  pickVote(card: VoteCard): void {
    const vm = this.roomView();
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    this.actionError.set(null);
    if (!vm?.canVote || !uid || !sid || !vm.activeStoryId || this.voteSubmitBusy()) {
      return;
    }
    this.pendingLocalVote.set({
      card,
      storyId: vm.activeStoryId,
      roundEpoch: vm.roundEpoch,
    });
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
        error: () => {
          this.pendingLocalVote.set(null);
          this.actionError.set('Could not save your vote. Check your connection and permissions.');
        },
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
    if (!environment.roundTimerUiEnabled) {
      return;
    }
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
    if (!environment.roundTimerUiEnabled) {
      return;
    }
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
    if (!environment.roundTimerUiEnabled) {
      return;
    }
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
    if (!environment.roundTimerUiEnabled) {
      return;
    }
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

  createStory(
    title: string,
    description: string,
    makeActive: boolean,
    jiraIssueKey?: string | null,
  ): void {
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
      .createStory(sid, uid, { title, description, makeActive, jiraIssueKey: jiraIssueKey ?? null })
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

  /** Current moderator only — hands role to another participant who has already joined. */
  transferModeratorTo(newModeratorMemberId: string): void {
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    const next = newModeratorMemberId.trim();
    if (!uid || !sid || !next || this.moderationBusy()) {
      return;
    }
    if (next === uid) {
      return;
    }
    this.actionError.set(null);
    this.moderationBusy.set(true);
    this.moderation
      .transferModerator(sid, uid, next)
      .pipe(
        take(1),
        finalize(() => this.moderationBusy.set(false)),
      )
      .subscribe({
        error: (err: unknown) => this.setActionErrorFromUnknown(err),
      });
  }

  setAutoRevealWhenAllVoted(enabled: boolean): void {
    const uid = this.auth.currentUser?.uid ?? null;
    const sid = this.sessionId();
    if (!uid || !sid || this.moderationBusy()) {
      return;
    }
    const vm = this.roomView();
    if (!vm?.isModerator) {
      return;
    }
    this.actionError.set(null);
    this.moderationBusy.set(true);
    this.moderation
      .setAutoRevealWhenAllVoted(sid, uid, enabled)
      .pipe(
        take(1),
        finalize(() => this.moderationBusy.set(false)),
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
