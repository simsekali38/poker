import { Component, input } from '@angular/core';

/** Shown when derived `everyoneActiveVoted` is true (computed in VM from members + votes). */
@Component({
  selector: 'app-room-everyone-voted-banner',
  standalone: true,
  template: `
    @if (show()) {
      <div
        class="animate-fade-up flex items-center gap-3 rounded-card-sm border border-success/25 bg-success/10 px-4 py-3 text-sm font-semibold text-ink shadow-sm"
        role="status"
      >
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success text-sm text-white shadow-sm"
          aria-hidden="true"
          >✓</span>
        <div class="min-w-0 leading-snug">
          <span class="block text-success">Everyone has voted</span>
          <span class="block text-xs font-medium text-muted" dir="rtl">כולם הצביעו</span>
        </div>
      </div>
    }
  `,
})
export class RoomEveryoneVotedBannerComponent {
  /** From `PlanningRoomViewModel.everyoneActiveVoted` (store → VM builder → util). */
  readonly everyoneActiveVoted = input(false);
  readonly votesRevealed = input(false);
  readonly hasActiveStory = input(false);

  protected show(): boolean {
    return (
      this.everyoneActiveVoted() && !this.votesRevealed() && this.hasActiveStory()
    );
  }
}
