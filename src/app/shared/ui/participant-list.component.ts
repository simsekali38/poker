import { Component, input } from '@angular/core';
import { SessionMember } from '@app/core/models';

@Component({
  selector: 'app-participant-list',
  standalone: true,
  templateUrl: './participant-list.component.html',
  styleUrl: './participant-list.component.scss',
})
export class ParticipantListComponent {
  readonly members = input<SessionMember[]>([]);
  readonly localMemberId = input<string | null>(null);
  readonly moderatorId = input<string | null>(null);
  /** When votes are hidden, pass which member ids have submitted. */
  readonly votedMemberIds = input<ReadonlySet<string>>(new Set());

  protected trackMember(_i: number, m: SessionMember): string {
    return m.id;
  }

  protected hasVoted(member: SessionMember): boolean {
    return this.votedMemberIds().has(member.id);
  }
}
