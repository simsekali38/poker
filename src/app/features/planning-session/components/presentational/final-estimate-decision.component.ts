import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FinalEstimateMethod, VoteCard } from '@app/core/models';
import { JiraBackendService } from '@app/core/services/jira-backend.service';
import { environment } from '@env/environment';
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
  imports: [UiPanelComponent, UiButtonDirective, VoteLabelPipe, DecimalPipe, DatePipe],
  templateUrl: './final-estimate-decision.component.html',
  styleUrl: './final-estimate-decision.component.scss',
})
export class FinalEstimateDecisionComponent {
  protected readonly store = inject(PlanningSessionStore);
  private readonly jiraBackend = inject(JiraBackendService);

  readonly decision = input.required<FinalEstimateDecisionVm>();
  /** Distinguish voting rounds so default selection re-runs after reset. */
  readonly roundEpoch = input(0);

  protected readonly jiraOAuthBusy = signal(false);

  /** Prevents duplicate auto-apply for the same story + round. */
  private defaultRoundedAppliedKey = '';

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
    this.store.sendFinalEstimateToJira();
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
}
