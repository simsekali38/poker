import { Component, input, output } from '@angular/core';
import { UiPanelComponent } from '@app/shared/ui/design-system';
import { PlanningRoomViewModel } from '../../models/planning-room.view-model';
import { RoomParticipantListComponent } from './room-participant-list.component';
import { RoomStoryHistoryComponent } from './room-story-history.component';

@Component({
  selector: 'app-planning-room-sidebar',
  standalone: true,
  imports: [UiPanelComponent, RoomParticipantListComponent, RoomStoryHistoryComponent],
  template: `
    <aside class="sidebar" aria-label="Session sidebar">
      <app-ui-panel
        title="Participants"
        [compact]="true"
        [hover]="true"
        [labelledBy]="'participants-heading'"
      >
        <app-room-participant-list [rows]="vm().participants" [votesRevealed]="vm().votesRevealed" />
      </app-ui-panel>
      <div class="sidebar__stories" aria-label="Stories">
        <app-room-story-history
          [rows]="vm().storyHistoryRows"
          [isModerator]="vm().isModerator"
          [busy]="storyBusy()"
          (switchStory)="switchStory.emit($event)"
          (createStory)="createStory.emit($event)"
        />
      </div>
    </aside>
  `,
  styleUrl: './planning-room-sidebar.component.scss',
})
export class PlanningRoomSidebarComponent {
  readonly vm = input.required<PlanningRoomViewModel>();
  readonly storyBusy = input(false);
  readonly switchStory = output<string>();
  readonly createStory = output<{ title: string; description: string; makeActive: boolean }>();
}
