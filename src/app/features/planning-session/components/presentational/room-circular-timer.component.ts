import { Component, input, output } from '@angular/core';
import { UiButtonDirective } from '@app/shared/ui/design-system';
import { formatCountdownMmSs } from '@app/shared/utils/round-timer-remaining.util';

/**
 * Presentation-only round timer: receives Firestore-synced state from `PlanningSessionStore` /
 * `PlanningRoomViewModel` (same contract as the previous bar timer). SVG ring progress is derived
 * from `remainingSec` + `durationSec` + `isRunning`; no timer interval logic here.
 */
@Component({
  selector: 'app-room-circular-timer',
  standalone: true,
  imports: [UiButtonDirective],
  templateUrl: './room-circular-timer.component.html',
  styleUrl: './room-circular-timer.component.scss',
})
export class RoomCircularTimerComponent {
  private static readonly R = 52;
  readonly ringCircumference = 2 * Math.PI * RoomCircularTimerComponent.R;

  /** `null` when timer not running — center shows configured duration as preview. */
  readonly remainingSec = input<number | null>(null);
  readonly durationSec = input(60);
  readonly isRunning = input(false);
  readonly isModerator = input(false);
  readonly busy = input(false);

  readonly start = output<void>();
  readonly stop = output<void>();
  readonly reset = output<void>();
  readonly durationChange = output<number>();

  protected centerLabel(): string {
    const rem = this.remainingSec();
    if (this.isRunning() && rem !== null) {
      return formatCountdownMmSs(Math.max(0, rem));
    }
    return formatCountdownMmSs(Math.max(0, this.durationSec()));
  }

  protected subtitle(): string {
    if (!this.isRunning()) {
      return 'Ready';
    }
    const rem = this.remainingSec();
    if (rem === null) {
      return '';
    }
    if (rem <= 0) {
      return "Time's up";
    }
    if (rem < 10) {
      return 'Wrapping up';
    }
    return 'Remaining';
  }

  /** 1 = full ring, 0 = empty (time elapsed). */
  protected progressFraction(): number {
    const total = Math.max(1, this.durationSec());
    if (!this.isRunning()) {
      return 1;
    }
    const rem = this.remainingSec();
    if (rem === null) {
      return 0;
    }
    return Math.min(1, Math.max(0, rem / total));
  }

  protected ringOffset(): number {
    return this.ringCircumference * (1 - this.progressFraction());
  }

  protected warnVisual(): boolean {
    const rem = this.remainingSec();
    return this.isRunning() && rem !== null && rem > 0 && rem < 10;
  }

  protected dangerVisual(): boolean {
    const rem = this.remainingSec();
    return this.isRunning() && rem !== null && rem <= 5;
  }

  protected finishedVisual(): boolean {
    const rem = this.remainingSec();
    return this.isRunning() && rem !== null && rem <= 0;
  }

  protected onDurationInput(ev: Event): void {
    const v = Number((ev.target as HTMLInputElement).value);
    if (Number.isFinite(v)) {
      this.durationChange.emit(v);
    }
  }
}
