import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-session-header',
  standalone: true,
  templateUrl: './session-header.component.html',
  styleUrl: './session-header.component.scss',
})
export class SessionHeaderComponent {
  readonly sessionTitle = input<string>('');
  /** Raw id for invite URLs; optional separate display label. */
  readonly sessionId = input<string>('');
  /** Shown in UI (e.g. formatted code); falls back to `sessionId`. */
  readonly sessionCodeDisplay = input<string>('');
  readonly copyInvite = output<void>();

  protected displayCode(): string {
    return this.sessionCodeDisplay().trim() || this.sessionId() || '—';
  }

  protected onCopy(): void {
    this.copyInvite.emit();
  }
}
