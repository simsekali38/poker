import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-planning-room-missing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="empty-state" role="alert">
      <h1 class="page-title">Session not available</h1>
      <p class="empty-state__text">
        This session does not exist, was removed, or is closed. Check the link or ask the moderator for a
        new invite.
      </p>
      <a routerLink="/" class="link-home">Back to home</a>
    </div>
  `,
  styleUrl: './planning-room-missing.component.scss',
})
export class PlanningRoomMissingComponent {}
