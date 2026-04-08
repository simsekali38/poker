import { Component, inject, input, output } from '@angular/core';
import { environment } from '@env/environment';
import { UiPanelComponent } from '@app/shared/ui/design-system';
import { RevealControlsComponent } from '@app/shared/ui/reveal-controls.component';
import { StoryPanelComponent } from '@app/shared/ui/story-panel.component';
import { VotingCardGridComponent } from '@app/shared/ui/voting-card-grid.component';
import { PlanningRoomViewModel } from '../../models/planning-room.view-model';
import { PlanningSessionStore } from '../../store/planning-session.store';
import { FinalEstimateDecisionComponent } from './final-estimate-decision.component';
import { JiraLinkedIssuePanelComponent } from './jira-linked-issue-panel.component';
import { RoomCircularTimerComponent } from './room-circular-timer.component';
import { RoomEveryoneVotedBannerComponent } from './room-everyone-voted-banner.component';
import { RoomResultsPanelComponent } from './room-results-panel.component';
import { RoomVotingStatusComponent } from './room-voting-status.component';

@Component({
  selector: 'app-planning-room-main-column',
  standalone: true,
  imports: [
    UiPanelComponent,
    StoryPanelComponent,
    RoomVotingStatusComponent,
    RoomCircularTimerComponent,
    RoomEveryoneVotedBannerComponent,
    VotingCardGridComponent,
    RevealControlsComponent,
    RoomResultsPanelComponent,
    FinalEstimateDecisionComponent,
    JiraLinkedIssuePanelComponent,
  ],
  templateUrl: './planning-room-main-column.component.html',
  styleUrl: './planning-room-main-column.component.scss',
})
export class PlanningRoomMainColumnComponent {
  readonly sessionStore = inject(PlanningSessionStore);

  /** Show Jira issue preview when backend URL is configured. */
  protected readonly jiraIssuePreviewEnabled =
    environment.jiraIntegrationEnabled && Boolean(environment.jiraBackendApiUrl?.trim());

  readonly vm = input.required<PlanningRoomViewModel>();
  readonly voteSubmitBusy = input(false);
  readonly moderationBusy = input(false);
  readonly cardPicked = output<string>();
  readonly reveal = output<void>();
  readonly resetRound = output<void>();
  readonly editStory = output<void>();
}
