/** Server-synced round timer on the session document (`roundTimer` map). */
export interface RoundTimerState {
  /** Configured countdown length in seconds (default 60). */
  durationSec: number;
  isRunning: boolean;
  /** Server time when the current run started; null when stopped. */
  startedAt: Date | null;
}

export const DEFAULT_ROUND_TIMER_DURATION_SEC = 60;
