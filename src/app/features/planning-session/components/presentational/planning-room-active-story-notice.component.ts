import { Component, input } from '@angular/core';

@Component({
  selector: 'app-planning-room-active-story-notice',
  standalone: true,
  template: `
    @if (!hasActiveStory()) {
      <p class="notice" role="status">
        @if (canManageStories()) {
          Use <strong>Stories</strong> in the sidebar to add one with a title and set it as the current voting
          item.
        } @else {
          No active story yet. The moderator will add the next item to estimate.
        }
      </p>
    }
  `,
  styleUrl: './planning-room-active-story-notice.component.scss',
})
export class PlanningRoomActiveStoryNoticeComponent {
  readonly hasActiveStory = input(false);
  readonly canManageStories = input(false);
}
