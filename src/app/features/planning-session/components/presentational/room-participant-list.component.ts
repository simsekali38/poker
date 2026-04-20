import { Component, input, output } from '@angular/core';
import { VoteLabelPipe } from '@app/shared/pipes/vote-label.pipe';
import { ParticipantRowVm } from '../../models/planning-room.view-model';

@Component({
  selector: 'app-room-participant-list',
  standalone: true,
  imports: [VoteLabelPipe],
  templateUrl: './room-participant-list.component.html',
  styleUrl: './room-participant-list.component.scss',
})
export class RoomParticipantListComponent {
  readonly rows = input<ParticipantRowVm[]>([]);
  readonly votesRevealed = input(false);
  /** Current user is moderator and may hand off the role. */
  readonly canTransferModerator = input(false);
  /** Moderator may remove other participants (not themselves, not the moderator row). */
  readonly canRemoveMembers = input(false);
  readonly transferBusy = input(false);
  readonly requestTransferModerator = output<string>();
  readonly requestRemoveMember = output<string>();

  protected trackRow(_i: number, r: ParticipantRowVm): string {
    return r.memberId;
  }

  protected voteAria(p: ParticipantRowVm): string {
    if (p.cardLabel !== null) {
      return `Revealed vote: ${p.cardLabel}`;
    }
    if (p.hasVoted && !this.votesRevealed()) {
      return 'Voted, card hidden until moderator reveals';
    }
    if (p.hasVoted) {
      return 'Voted';
    }
    return 'Not voted yet';
  }

  protected initialsFor(displayName: string): string {
    const t = displayName.trim();
    if (!t) {
      return '?';
    }
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0] ?? '';
      const b = parts[parts.length - 1][0] ?? '';
      return (a + b).toUpperCase();
    }
    const word = parts[0] ?? t;
    if (word.length >= 2) {
      return word.slice(0, 2).toUpperCase();
    }
    return word[0].toUpperCase();
  }
}
