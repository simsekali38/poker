import { Component, inject, input, output } from '@angular/core';
import { UiPanelComponent } from '@app/shared/ui/design-system';
import { PlanningRoomViewModel } from '../../models/planning-room.view-model';
import { RoomParticipantListComponent } from './room-participant-list.component';
import { RoomStoryHistoryComponent } from './room-story-history.component';
import { PlanningSessionStore } from '../../store/planning-session.store';

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
        <app-room-participant-list
          [rows]="vm().participants"
          [votesRevealed]="vm().votesRevealed"
          [canTransferModerator]="vm().isModerator && vm().sessionStatus === 'active'"
          [canRemoveMembers]="vm().isModerator && vm().sessionStatus === 'active'"
          [transferBusy]="store.moderationBusy()"
          (requestTransferModerator)="onRequestTransferModerator($event)"
          (requestRemoveMember)="onRequestRemoveMember($event)"
        />
      </app-ui-panel>
      <div class="sidebar__stories" aria-label="Stories">
        <app-room-story-history
          [rows]="vm().storyHistoryRows"
          [isModerator]="vm().isModerator"
          [busy]="storyBusy()"
          [jiraSiteUrl]="vm().jiraSiteUrl"
          [jiraStoryImportAvailable]="vm().jiraStoryImportAvailable"
          (switchStory)="switchStory.emit($event)"
          (createStory)="createStory.emit($event)"
        />
      </div>
    </aside>
  `,
  styleUrl: './planning-room-sidebar.component.scss',
})
export class PlanningRoomSidebarComponent {
  protected readonly store = inject(PlanningSessionStore);

  readonly vm = input.required<PlanningRoomViewModel>();

  protected onRequestTransferModerator(memberId: string): void {
    const name =
      this.vm().participants.find((p) => p.memberId === memberId)?.displayName?.trim() ||
      'this participant';
    const ok = confirm(
      `Make “${name}” the moderator?\n\nYou will lose moderator rights after the transfer.`,
    );
    if (!ok) {
      return;
    }
    this.store.transferModeratorTo(memberId);
  }

  protected onRequestRemoveMember(memberId: string): void {
    const name =
      this.vm().participants.find((p) => p.memberId === memberId)?.displayName?.trim() ||
      'this participant';
    const ok = confirm(
      `Remove “${name}” from this session?\n\nTheir votes for this session will be deleted.`,
    );
    if (!ok) {
      return;
    }
    this.store.removeSessionMember(memberId);
  }

  readonly storyBusy = input(false);
  readonly switchStory = output<string>();
  readonly createStory = output<{
    title: string;
    description: string;
    makeActive: boolean;
    jiraIssueKey?: string | null;
  }>();
}
