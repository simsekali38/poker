import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { VotingCardState } from './voting-card.types';

const VOTE_BTN_BASE =
  'w-full min-h-[4.5rem] min-w-[4.5rem] aspect-square inline-flex items-center justify-center rounded-card border text-base font-semibold tabular-nums touch-manipulation transition-all duration-180 ease-out ui-focus-ring disabled:pointer-events-none disabled:opacity-[0.48] disabled:shadow-sm';

/** Full literal strings so Tailwind JIT can detect utilities in this `.ts` file. */
const VOTE_STATE_CLASSES: Record<VotingCardState, string> = {
  default: `${VOTE_BTN_BASE} cursor-pointer border-black/[0.06] bg-surface text-ink shadow-card hover:scale-[1.04] hover:border-primary/20 hover:shadow-card-md active:scale-[0.96]`,
  selected: `${VOTE_BTN_BASE} cursor-pointer border-transparent bg-primary text-white shadow-card-md ring-1 ring-primary/25 hover:scale-[1.03] hover:bg-primary-hover hover:shadow-card-lg active:scale-[0.97] active:bg-primary-active`,
  revealed: `${VOTE_BTN_BASE} cursor-pointer border-transparent bg-success text-white shadow-card-md ring-1 ring-success/30 hover:scale-[1.03] hover:shadow-card-lg hover:brightness-95 active:scale-[0.97] active:brightness-90`,
  disabled: `${VOTE_BTN_BASE} cursor-not-allowed border-black/[0.06] bg-surface text-ink shadow-sm`,
};

@Component({
  selector: 'app-voting-card',
  standalone: true,
  templateUrl: './voting-card.component.html',
  host: { class: 'block min-w-0' },
})
export class VotingCardComponent {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input.required<string>();
  readonly state = input<VotingCardState>('default');
  readonly focusTabIndex = input(0);
  readonly pick = output<void>();
  readonly deckNavigationKey = output<KeyboardEvent>();

  protected readonly votePulse = signal(false);
  private pulseTimer: ReturnType<typeof setTimeout> | undefined;
  private wasSelected = false;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.pulseTimer));
    effect(() => {
      const sel = this.state() === 'selected';
      if (sel && !this.wasSelected) {
        this.votePulse.set(true);
        clearTimeout(this.pulseTimer);
        this.pulseTimer = setTimeout(() => this.votePulse.set(false), 700);
      }
      this.wasSelected = sel;
    });
  }

  protected buttonClasses(): string {
    return VOTE_STATE_CLASSES[this.state()];
  }

  focusCard(): void {
    const btn = this.el.nativeElement.querySelector('button');
    if (btn instanceof HTMLButtonElement) {
      btn.focus();
    }
  }

  protected isDisabled(): boolean {
    return this.state() === 'disabled';
  }

  protected isSelectedLike(): boolean {
    const s = this.state();
    return s === 'selected' || s === 'revealed';
  }

  protected effectiveTabIndex(): number {
    return this.isDisabled() ? -1 : this.focusTabIndex();
  }

  protected select(): void {
    if (!this.isDisabled()) {
      this.pick.emit();
    }
  }

  protected onButtonKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) {
      return;
    }
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
      case 'Home':
      case 'End':
        event.preventDefault();
        this.deckNavigationKey.emit(event);
        break;
      default:
        break;
    }
  }
}
