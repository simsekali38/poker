import { Component } from '@angular/core';

@Component({
  selector: 'app-planning-room-loading',
  standalone: true,
  template: `<p class="state" aria-live="polite">Loading session…</p>`,
  styleUrl: './planning-room-loading.component.scss',
})
export class PlanningRoomLoadingComponent {}
