import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-planning-room-removed',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="empty-state" role="alert">
      <h1 class="page-title">Removed from session</h1>
      <p class="empty-state__text">
        A moderator removed you from this planning session. You can join again with the invite link if the
        session is still active.
      </p>
      <p class="empty-state__actions">
        <a [routerLink]="['/session/join', sessionId()]" class="link-primary">Join again</a>
        <a routerLink="/" class="link-home">Back to home</a>
      </p>
    </div>
  `,
  styleUrls: ['./planning-room-missing.component.scss', './planning-room-removed.component.scss'],
})
export class PlanningRoomRemovedComponent {
  readonly sessionId = input.required<string>();
}
