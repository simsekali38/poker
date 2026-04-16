import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FinalEstimateMethod, VoteCard } from '@app/core/models';
import {
  JiraBoardListRow,
  JiraBoardSprintRow,
  JiraPlanningIntegrationService,
} from '@app/core/services/jira-planning-integration.service';
import { JiraBackendService } from '@app/core/services/jira-backend.service';
import { environment } from '@env/environment';
import {
  parseJiraIssueKey,
  parseJiraProjectKeyFromIssue,
} from '@app/shared/utils/jira-issue-key.utils';
import { finalize } from 'rxjs';
import { VoteLabelPipe } from '@app/shared/pipes/vote-label.pipe';
import { UiButtonDirective, UiPanelComponent } from '@app/shared/ui/design-system';
import {
  FinalEstimateDecisionVm,
  isMethodSelected,
} from '../../view/final-estimate-vm.builder';
import { PlanningSessionStore } from '../../store/planning-session.store';

@Component({
  selector: 'app-final-estimate-decision',
  standalone: true,
  imports: [UiPanelComponent, UiButtonDirective, VoteLabelPipe, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './final-estimate-decision.component.html',
  styleUrl: './final-estimate-decision.component.scss',
})
export class FinalEstimateDecisionComponent {
  protected readonly store = inject(PlanningSessionStore);
  private readonly jiraBackend = inject(JiraBackendService);
  private readonly jiraPlanning = inject(JiraPlanningIntegrationService);

  readonly decision = input.required<FinalEstimateDecisionVm>();
  /** Distinguish voting rounds so default selection re-runs after reset. */
  readonly roundEpoch = input(0);

  protected readonly jiraOAuthBusy = signal(false);

  /** Boards returned from Jira for the linked issue’s project (Agile API). */
  protected readonly jiraProjectBoards = signal<readonly JiraBoardListRow[]>([]);
  protected readonly boardsDiscoveryLoading = signal(false);
  protected readonly boardsDiscoveryError = signal<string | null>(null);
  private jiraBoardsProbeKey = '';

  protected readonly boardSprints = signal<readonly JiraBoardSprintRow[]>([]);
  protected readonly boardDisplayName = signal<string | null>(null);
  protected readonly sprintsLoading = signal(false);
  protected readonly sprintsError = signal<string | null>(null);
  /** When set, issue is moved to this sprint on “Send to Jira”. */
  protected readonly selectedJiraSprintId = signal<number | null>(null);
  /** Agile API: sprint the linked issue is in (active, else future). */
  protected readonly jiraIssueCurrentSprintId = signal<number | null>(null);
  /** False until GET issue (with sprint) finishes for the current story. */
  protected readonly issueJiraSprintResolved = signal(false);
  /** Issue key input — synced from story when story id / stored key changes. */
  protected readonly jiraIssueInputDraft = signal('');
  /** Match Jira: hide sprints that originate from other boards (when `originBoardId` is present). */
  protected readonly sprintFilterThisBoardOnly = signal(true);

  protected readonly sprintsFiltered = computed(() => {
    const rows = this.boardSprints();
    const only = this.sprintFilterThisBoardOnly();
    const bid = this.decision().jiraBoardId?.trim();
    if (!only || !bid) {
      return rows;
    }
    const n = Number(bid);
    if (Number.isNaN(n)) {
      return rows;
    }
    return rows.filter((s) => s.originBoardId == null || s.originBoardId === n);
  });

  /** Ensures the issue’s current sprint row appears even if “this board only” would hide it. */
  protected readonly sprintsRowsForSelect = computed(() => {
    const filtered = this.sprintsFiltered();
    const mustShow = this.jiraIssueCurrentSprintId();
    if (mustShow == null || filtered.some((s) => s.id === mustShow)) {
      return filtered;
    }
    const row = this.boardSprints().find((s) => s.id === mustShow);
    return row ? [...filtered, row] : filtered;
  });

  protected readonly sprintsActive = computed(() =>
    this.sprintsRowsForSelect().filter((s) => s.state?.toLowerCase() === 'active'),
  );

  protected readonly sprintsFuture = computed(() =>
    this.sprintsRowsForSelect().filter((s) => s.state?.toLowerCase() === 'future'),
  );

  /** Native `<select>` + `[value]` is unreliable with dynamic options; use ngModel string. */
  protected readonly sprintSelectModel = computed(() => {
    const id = this.selectedJiraSprintId();
    return id === null || id === undefined ? '' : String(id);
  });

  /** Prevents duplicate auto-apply for the same story + round. */
  private defaultRoundedAppliedKey = '';

  private sprintFetchKey = '';
  private issueSprintProbeKey = '';
  /** After auto-select succeeds or backlog confirmed, skip until story/board/filter context changes. */
  private sprintAutoAppliedDone = false;
  private sprintAutoAppliedContext = '';
  private jiraIssueDraftSync: { storyId: string; issueKey: string } | null = null;

  constructor() {
    effect(() => {
      const d = this.decision();
      const epoch = this.roundEpoch();
      const key = `${d.story.id}:${epoch}`;

      if (!d.average.available || !d.average.roundedCard) {
        return;
      }
      if (d.story.finalEstimateMethod != null || d.story.finalEstimateCard != null) {
        return;
      }
      if (this.store.finalEstimateBusy()) {
        return;
      }
      if (this.defaultRoundedAppliedKey === key) {
        return;
      }
      this.defaultRoundedAppliedKey = key;
      untracked(() => this.store.selectRoundedAverageFinalEstimate());
    });

    effect(() => {
      const d = this.decision();
      const id = d.story.id;
      const key = d.story.jiraIssueKey ?? '';
      const prev = this.jiraIssueDraftSync;
      if (prev && prev.storyId === id && prev.issueKey === key) {
        return;
      }
      this.jiraIssueDraftSync = { storyId: id, issueKey: key };
      untracked(() => this.jiraIssueInputDraft.set(key));
    });

    effect(() => {
      const d = this.decision();
      const site = d.jiraSiteUrl?.trim();
      const issueKey = parseJiraIssueKey(d.story.jiraIssueKey ?? '');
      if (!site || !issueKey || !d.jiraSessionReady || !d.jiraIntegrationAvailable) {
        untracked(() => {
          this.jiraIssueCurrentSprintId.set(null);
          this.issueJiraSprintResolved.set(false);
          this.issueSprintProbeKey = '';
        });
        return;
      }
      const probe = `${d.story.id}:${issueKey}:${site}`;
      if (this.issueSprintProbeKey === probe) {
        return;
      }
      untracked(() => {
        this.issueSprintProbeKey = probe;
        this.issueJiraSprintResolved.set(false);
        this.jiraBackend
          .getIssue(issueKey, site, { includeCurrentSprint: true })
          .pipe(
            finalize(() => {
              this.issueJiraSprintResolved.set(true);
            }),
          )
          .subscribe({
            next: (issue) => {
              const sid = issue.currentSprintId as number | string | null | undefined;
              const n =
                sid == null || sid === ''
                  ? NaN
                  : typeof sid === 'number'
                    ? sid
                    : Number(String(sid).trim());
              this.jiraIssueCurrentSprintId.set(Number.isFinite(n) ? n : null);
            },
            error: () => {
              this.jiraIssueCurrentSprintId.set(null);
            },
          });
      });
    });

    effect(() => {
      const d = this.decision();
      const site = d.jiraSiteUrl?.trim();
      const pk = parseJiraProjectKeyFromIssue(d.story.jiraIssueKey);
      if (!site || !pk || !d.jiraSessionReady || !d.jiraIntegrationAvailable) {
        untracked(() => {
          this.jiraProjectBoards.set([]);
          this.boardsDiscoveryError.set(null);
          this.jiraBoardsProbeKey = '';
        });
        return;
      }
      const probe = `${site}:${pk}`;
      if (this.jiraBoardsProbeKey === probe) {
        return;
      }
      untracked(() => {
        this.jiraBoardsProbeKey = probe;
        this.loadJiraBoardsForProject(site, pk);
      });
    });

    effect(() => {
      const d = this.decision();
      const site = d.jiraSiteUrl?.trim();
      const bid = d.jiraBoardId?.trim();
      if (!site || !bid || !d.jiraSessionReady || !d.jiraIntegrationAvailable) {
        untracked(() => {
          this.boardSprints.set([]);
          this.boardDisplayName.set(null);
          this.sprintsError.set(null);
          this.selectedJiraSprintId.set(null);
          this.sprintFetchKey = '';
        });
        return;
      }
      const key = `${site}:${bid}`;
      if (this.sprintFetchKey === key) {
        return;
      }
      untracked(() => {
        this.sprintFetchKey = key;
        this.selectedJiraSprintId.set(null);
        this.sprintAutoAppliedDone = false;
        this.sprintAutoAppliedContext = '';
        this.loadBoardSprints(site, bid);
      });
    });

    effect(() => {
      const d = this.decision();
      d.story.id;
      d.jiraBoardId;
      this.jiraIssueCurrentSprintId();
      this.issueJiraSprintResolved();
      this.boardSprints();
      this.sprintFilterThisBoardOnly();
      untracked(() => this.tryAutoSelectSprintFromIssue());
    });
  }

  protected refreshJiraBoardDiscovery(): void {
    const site = this.decision().jiraSiteUrl?.trim();
    const pk = parseJiraProjectKeyFromIssue(this.decision().story.jiraIssueKey);
    if (!site || !pk) {
      return;
    }
    this.jiraBoardsProbeKey = '';
    untracked(() => {
      this.jiraBoardsProbeKey = `${site}:${pk}`;
      this.loadJiraBoardsForProject(site, pk);
    });
  }

  private sortJiraBoards(boards: JiraBoardListRow[]): JiraBoardListRow[] {
    return [...boards].sort((a, b) => {
      const ta = a.type?.toLowerCase() === 'scrum' ? 0 : 1;
      const tb = b.type?.toLowerCase() === 'scrum' ? 0 : 1;
      if (ta !== tb) {
        return ta - tb;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  private loadJiraBoardsForProject(site: string, projectKey: string): void {
    this.boardsDiscoveryLoading.set(true);
    this.boardsDiscoveryError.set(null);
    this.jiraPlanning.listBoardsForProject(site, projectKey).subscribe({
      next: (r) => {
        const boards = this.sortJiraBoards([...r.boards]);
        this.jiraProjectBoards.set(boards);
        this.boardsDiscoveryLoading.set(false);
        const hasBid = !!this.decision().jiraBoardId?.trim();
        if (!hasBid && boards.length === 1) {
          this.store.saveSessionJiraBoardId(String(boards[0].id));
        }
      },
      error: (err: unknown) => {
        this.boardsDiscoveryLoading.set(false);
        this.jiraProjectBoards.set([]);
        if (err instanceof HttpErrorResponse) {
          const body = err.error as { error?: string } | string | null;
          const msg =
            typeof body === 'object' && body && typeof body.error === 'string'
              ? body.error
              : err.message;
          this.boardsDiscoveryError.set(msg || `Could not load boards (${err.status}).`);
          return;
        }
        this.boardsDiscoveryError.set(err instanceof Error ? err.message : 'Could not load boards.');
      },
    });
  }

  protected onJiraBoardSelectFromList(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    if (v) {
      this.store.saveSessionJiraBoardId(v);
    }
  }

  protected selectedBoardSelectValue(): string {
    return this.decision().jiraBoardId?.trim() ?? '';
  }

  private tryAutoSelectSprintFromIssue(): void {
    const d = this.decision();
    const ctx = `${d.story.id}:${d.jiraBoardId?.trim() ?? ''}:${this.sprintFilterThisBoardOnly()}`;
    if (this.sprintAutoAppliedContext !== ctx) {
      this.sprintAutoAppliedContext = ctx;
      this.sprintAutoAppliedDone = false;
    }
    if (this.sprintAutoAppliedDone) {
      return;
    }
    if (!this.issueJiraSprintResolved()) {
      return;
    }
    const rows = this.boardSprints();
    if (rows.length === 0) {
      return;
    }

    const sprintId = this.jiraIssueCurrentSprintId();
    if (sprintId == null) {
      this.sprintAutoAppliedDone = true;
      return;
    }

    if (!rows.some((s) => s.id === sprintId)) {
      this.sprintAutoAppliedDone = true;
      return;
    }

    this.selectedJiraSprintId.set(sprintId);
    this.sprintAutoAppliedDone = true;
  }

  protected loadBoardSprints(siteUrl: string, boardId: string): void {
    this.sprintsLoading.set(true);
    this.sprintsError.set(null);
    this.jiraPlanning.listBoardSprints(siteUrl, boardId).subscribe({
      next: (r) => {
        this.boardDisplayName.set(r.board.name ?? null);
        this.boardSprints.set([...r.sprints]);
        this.sprintsLoading.set(false);
      },
      error: (err: unknown) => {
        this.sprintsLoading.set(false);
        this.boardSprints.set([]);
        this.boardDisplayName.set(null);
        if (err instanceof HttpErrorResponse) {
          const body = err.error as { error?: string } | string | null;
          const msg =
            typeof body === 'object' && body && typeof body.error === 'string'
              ? body.error
              : err.message;
          this.sprintsError.set(msg || `Could not load sprints (${err.status}).`);
          return;
        }
        this.sprintsError.set(err instanceof Error ? err.message : 'Could not load sprints.');
      },
    });
  }

  protected onSprintSelectModelChange(value: string): void {
    this.selectedJiraSprintId.set(value === '' ? null : Number(value));
    this.sprintAutoAppliedDone = true;
  }

  protected onJiraIssueInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.jiraIssueInputDraft.set(v);
  }

  protected toggleSprintBoardFilter(): void {
    this.sprintFilterThisBoardOnly.update((x) => !x);
  }

  protected methodSelected(method: FinalEstimateMethod): boolean {
    return isMethodSelected(this.decision().story, method);
  }

  protected methodLabel(method: FinalEstimateMethod): string {
    switch (method) {
      case 'consensus':
        return 'Consensus';
      case 'rounded_average':
        return 'Rounded up average';
      case 'moderator_pick':
        return 'Moderator selection';
      default:
        return method;
    }
  }

  protected onConsensus(): void {
    this.store.selectConsensusFinalEstimate();
  }

  protected onAverage(): void {
    this.store.selectRoundedAverageFinalEstimate();
  }

  protected onModeratorCard(card: VoteCard): void {
    this.store.selectModeratorFinalEstimate(card);
  }

  protected onSendJira(): void {
    this.store.sendFinalEstimateToJira(this.selectedJiraSprintId());
  }

  /** POST /jira/oauth/start then redirect to Atlassian. */
  protected startConnectJira(): void {
    if (!environment.jiraBackendApiUrl?.trim() || this.jiraOAuthBusy()) {
      return;
    }
    const returnUrl = globalThis.location.href.split('#')[0];
    this.jiraOAuthBusy.set(true);
    this.jiraBackend.startOAuth(returnUrl).subscribe({
      next: (r) => {
        globalThis.location.assign(r.redirectUrl);
      },
      error: () => {
        this.jiraOAuthBusy.set(false);
      },
    });
  }

  protected showConnectJira(): boolean {
    return environment.jiraIntegrationEnabled && Boolean(environment.jiraBackendApiUrl?.trim());
  }

  /** Project key parsed from the linked issue (for board discovery UI). */
  protected issueProjectKey(): string | null {
    return parseJiraProjectKeyFromIssue(this.decision().story.jiraIssueKey);
  }

  /** Single discovered board id matches session `jiraBoardId` (after auto-save). */
  protected singleBoardMatchesSession(): boolean {
    const boards = this.jiraProjectBoards();
    const bid = this.decision().jiraBoardId?.trim();
    if (boards.length !== 1 || !bid) {
      return false;
    }
    return bid === String(boards[0].id);
  }
}
