import { Component, input, output } from '@angular/core';
import { RevealControlsComponent } from '@app/shared/ui/reveal-controls.component';
import { StoryPanelComponent } from '@app/shared/ui/story-panel.component';
import { VotingCardGridComponent } from '@app/shared/ui/voting-card-grid.component';
import { PlanningRoomViewModel } from '../../models/planning-room.view-model';
import { RoomResultsPanelComponent } from './room-results-panel.component';
import { RoomVotingStatusComponent } from './room-voting-status.component';

@Component({
  selector: 'app-planning-room-main-column',
  standalone: true,
  imports: [
    StoryPanelComponent,
    RoomVotingStatusComponent,
    VotingCardGridComponent,
    RevealControlsComponent,
    RoomResultsPanelComponent,
  ],
  template: `
    <section class="flex min-w-0 flex-col gap-4" aria-label="Voting">
      <app-story-panel
        [story]="vm().story"
        [canEdit]="vm().canEditActiveStory"
        (editRequest)="editStory.emit()"
      />
      <div class="ui-surface-card ui-surface-card--hover rounded-card p-5 md:p-6">
        <h2 class="m-0 text-[1.0625rem] font-semibold tracking-tight text-ink">Round progress</h2>
        <app-room-voting-status
          [votedCount]="vm().votedCount"
          [participantCount]="vm().participantCount"
          [votesRevealed]="vm().votesRevealed"
        />
      </div>
      <div class="ui-surface-card ui-surface-card--hover rounded-card p-5 md:p-6">
        <h2 class="m-0 text-[1.0625rem] font-semibold tracking-tight text-ink">Your vote</h2>
        <app-voting-card-grid
          [cards]="vm().deck"
          [selectedCard]="vm().localVote"
          [disabled]="!vm().canVote || voteSubmitBusy()"
          (cardPicked)="cardPicked.emit($event)"
        />
        @if (
          vm().sessionStatus === 'active' && !vm().canVote && vm().activeStoryId && !vm().votesRevealed
        ) {
          <p class="m-0 mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Join this session with your display name to vote, or wait for the next round.
          </p>
        }
      </div>
      <div class="ui-surface-card ui-surface-card--hover mt-10 rounded-card p-5 pt-6 md:p-6 md:pt-8">
        <h2 class="m-0 text-[1.0625rem] font-semibold tracking-tight text-ink">
          @if (vm().isModerator) {
            Moderator controls
          } @else {
            Reveal
          }
        </h2>
        @if (vm().isModerator) {
          <p class="mb-2 mt-1 max-w-xl text-[0.8125rem] leading-snug text-muted">
            Run the round after everyone has picked a card.
          </p>
        }
        <app-reveal-controls
          [isModerator]="vm().isModerator"
          [votesRevealed]="vm().votesRevealed"
          [canReveal]="vm().canReveal"
          [canResetRound]="vm().canResetRound"
          [votesReadyToReveal]="
            vm().isModerator &&
            vm().participantCount > 0 &&
            vm().votedCount >= vm().participantCount &&
            !vm().votesRevealed
          "
          [busy]="moderationBusy()"
          (reveal)="reveal.emit()"
          (resetRound)="resetRound.emit()"
        />
      </div>
      <app-room-results-panel
        [rows]="vm().results"
        [numericAverage]="vm().numericAverage"
        [votesRevealed]="vm().votesRevealed"
        [hasActiveStory]="!!vm().activeStoryId"
      />
    </section>
  `,
})
export class PlanningRoomMainColumnComponent {
  readonly vm = input.required<PlanningRoomViewModel>();
  readonly voteSubmitBusy = input(false);
  readonly moderationBusy = input(false);
  readonly cardPicked = output<string>();
  readonly reveal = output<void>();
  readonly resetRound = output<void>();
  readonly editStory = output<void>();
}
