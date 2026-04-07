import { Component, input, output } from '@angular/core';
import { UiButtonDirective } from '@app/shared/ui/design-system';

@Component({
  selector: 'app-reveal-controls',
  standalone: true,
  imports: [UiButtonDirective],
  templateUrl: './reveal-controls.component.html',
  styleUrl: './reveal-controls.component.scss',
})
export class RevealControlsComponent {
  readonly isModerator = input(false);
  /** When true, results are visible to everyone. */
  readonly votesRevealed = input(false);
  /** Moderator + active story + not yet revealed. */
  readonly canReveal = input(false);
  /** Moderator + active story (reset allowed before or after reveal). */
  readonly canResetRound = input(false);
  /** All participants have cast a vote; show emphasis before reveal. */
  readonly votesReadyToReveal = input(false);
  readonly busy = input(false);

  readonly reveal = output<void>();
  readonly resetRound = output<void>();

  protected onReveal(): void {
    if (this.canReveal() && !this.busy()) {
      this.reveal.emit();
    }
  }

  protected onReset(): void {
    if (this.canResetRound() && !this.busy()) {
      this.resetRound.emit();
    }
  }

}
