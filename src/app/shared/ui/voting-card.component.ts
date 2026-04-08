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
  /** When true, the card is not clickable (parent deck locked); still show selected/revealed styling. */
  readonly interactionLocked = input(false);
  readonly focusTabIndex = input(0);
  /** Incremented on each reveal transition; used to fire Web Animations once per reveal. */
  readonly revealWave = input(0);
  readonly staggerIndex = input(0);
  readonly pick = output<void>();
  readonly deckNavigationKey = output<KeyboardEvent>();

  protected readonly votePulse = signal(false);
  private pulseTimer: ReturnType<typeof setTimeout> | undefined;
  private wasSelected = false;
  private lastRevealWaveAnimated = 0;

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

    effect(() => {
      const wave = this.revealWave();
      const st = this.state();
      if (st !== 'revealed') {
        this.lastRevealWaveAnimated = 0;
        return;
      }
      if (wave === 0 || wave <= this.lastRevealWaveAnimated) {
        return;
      }
      this.lastRevealWaveAnimated = wave;
      queueMicrotask(() => this.playRevealFlip());
    });
  }

  private playRevealFlip(): void {
    const btn = this.el.nativeElement.querySelector('button');
    if (!btn || typeof btn.animate !== 'function') {
      return;
    }
    const delay = this.staggerIndex() * 70;
    btn.animate(
      [
        { opacity: 0.25, transform: 'scale(0.88) perspective(420px) rotateY(-14deg)' },
        { opacity: 1, transform: 'scale(1) perspective(420px) rotateY(0deg)' },
      ],
      {
        duration: 440,
        delay,
        easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
        fill: 'both',
      },
    );
  }

  protected buttonClasses(): string {
    return `vote-deck-card vote-deck-card--${this.state()}`;
  }

  focusCard(): void {
    const btn = this.el.nativeElement.querySelector('button');
    if (btn instanceof HTMLButtonElement) {
      btn.focus();
    }
  }

  protected isDisabled(): boolean {
    return this.interactionLocked() || this.state() === 'disabled';
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
