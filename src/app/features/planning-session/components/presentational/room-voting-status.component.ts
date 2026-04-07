import { Component, input } from '@angular/core';

@Component({
  selector: 'app-room-voting-status',
  standalone: true,
  templateUrl: './room-voting-status.component.html',
  styleUrl: './room-voting-status.component.scss',
})
export class RoomVotingStatusComponent {
  readonly votedCount = input(0);
  readonly participantCount = input(0);
  readonly votesRevealed = input(false);
}
