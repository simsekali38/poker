import { Component, input, output } from '@angular/core';
import { PlanningRoomViewModel } from '../../models/planning-room.view-model';
import { RoomParticipantListComponent } from './room-participant-list.component';
import { RoomStoryHistoryComponent } from './room-story-history.component';

@Component({
  selector: 'app-planning-room-sidebar',
  standalone: true,
  imports: [RoomParticipantListComponent, RoomStoryHistoryComponent],
  template: `
    <aside class="sidebar" aria-label="Session sidebar">
      <section class="sidebar-card" aria-labelledby="participants-heading">
        <h2 id="participants-heading" class="sidebar-card__title">Participants</h2>
        <app-room-participant-list [rows]="vm().participants" [votesRevealed]="vm().votesRevealed" />
      </section>
      <section class="sidebar-card" aria-label="Stories">
        <app-room-story-history
          [rows]="vm().storyHistoryRows"
          [isModerator]="vm().isModerator"
          [busy]="storyBusy()"
          (switchStory)="switchStory.emit($event)"
          (createStory)="createStory.emit($event)"
        />
      </section>
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
