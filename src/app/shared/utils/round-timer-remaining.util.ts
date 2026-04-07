import { RoundTimerState } from '@app/core/models';

/**
 * Remaining whole seconds while running; `null` when timer is stopped (UI shows configured duration instead).
 * Uses client `nowMs` vs `startedAt` from Firestore — small clock skew is acceptable for UX.
 */
export function roundTimerRemainingSec(timer: RoundTimerState, nowMs: number): number | null {
  if (!timer.isRunning || !timer.startedAt) {
    return null;
  }
  const elapsedSec = (nowMs - timer.startedAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(timer.durationSec - elapsedSec));
}

export function formatCountdownMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
