import {
  afterNextRender,
  Component,
  effect,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { VoteLabelPipe } from '@app/shared/pipes/vote-label.pipe';
import { VotingCardComponent } from './voting-card.component';
import { VotingCardState } from './voting-card.types';
import { VotingDeckPresentation, resolveVotingCardState } from './voting-deck.utils';

@Component({
  selector: 'app-voting-card-grid',
  standalone: true,
  imports: [VotingCardComponent, VoteLabelPipe],
  templateUrl: './voting-card-grid.component.html',
})
export class VotingCardGridComponent {
  private readonly cardRefs = viewChildren(VotingCardComponent);

  readonly cards = input<readonly string[]>([]);
  readonly selectedCard = input<string | null>(null);
  readonly disabled = input(false);
  readonly presentation = input<VotingDeckPresentation>('picker');
  /** When this flips false→true, `revealWave` increments so cards can run a one-shot reveal animation. */
  readonly votesRevealed = input(false);
  readonly ariaLabel = input('Estimation cards');

  readonly cardPicked = output<string>();

  protected readonly focusIndex = signal(0);
  protected readonly revealWave = signal(0);
  protected readonly mobileSwipe = signal(false);

  private touchStartX = 0;
  private wasVotesRevealed = false;

  constructor() {
    effect(() => {
      const len = this.cards().length;
      if (len === 0) {
        this.focusIndex.set(0);
        return;
      }
      this.focusIndex.update((i) => Math.max(0, Math.min(len - 1, i)));
    });

    effect(() => {
      const r = this.votesRevealed();
      if (!r) {
        this.wasVotesRevealed = false;
        return;
      }
      if (r && !this.wasVotesRevealed) {
        this.revealWave.update((x) => x + 1);
      }
      this.wasVotesRevealed = r;
    });

    afterNextRender(() => {
      const w = globalThis.window;
      const mq = w.matchMedia('(max-width: 640px)');
      const apply = () => this.mobileSwipe.set(mq.matches);
      apply();
      mq.addEventListener('change', apply);
    });
  }

  protected cardState(value: string): VotingCardState {
    return resolveVotingCardState({
      cardValue: value,
      selectedValue: this.selectedCard(),
      deckDisabled: this.disabled(),
      presentation: this.presentation(),
    });
  }

  protected isSelected(card: string): boolean {
    return this.selectedCard() === card;
  }

  protected focusTabIndexFor(i: number): number {
    return this.focusIndex() === i ? 0 : -1;
  }

  protected onCardFocus(index: number): void {
    this.focusIndex.set(index);
  }

  protected onDeckNav(event: KeyboardEvent, fromIndex: number): void {
    const list = this.cards();
    const len = list.length;
    if (len === 0) {
      return;
    }
    let next = fromIndex;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (fromIndex + 1) % len;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (fromIndex - 1 + len) % len;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = len - 1;
        break;
      default:
        return;
    }
    this.focusIndex.set(next);
    queueMicrotask(() => {
      this.cardRefs()[next]?.focusCard();
    });
  }

  protected pick(value: string): void {
    if (!this.disabled()) {
      this.cardPicked.emit(value);
    }
  }

  protected onTouchStart(ev: TouchEvent): void {
    if (!this.mobileSwipe() || ev.touches.length !== 1) {
      return;
    }
    this.touchStartX = ev.touches[0].clientX;
  }

  protected onTouchEnd(ev: TouchEvent): void {
    if (!this.mobileSwipe() || this.disabled() || ev.changedTouches.length < 1) {
      return;
    }
    const dx = ev.changedTouches[0].clientX - this.touchStartX;
    const threshold = 48;
    if (dx < -threshold) {
      this.nudgeSwipeSelection(1);
    } else if (dx > threshold) {
      this.nudgeSwipeSelection(-1);
    }
  }

  private nudgeSwipeSelection(delta: number): void {
    const list = this.cards();
    const len = list.length;
    if (len === 0) {
      return;
    }
    const sel = this.selectedCard();
    let idx = sel !== null ? list.indexOf(sel) : this.focusIndex();
    if (idx < 0) {
      idx = 0;
    }
    const next = (idx + delta + len) % len;
    this.pick(list[next]);
    this.focusIndex.set(next);
  }
}
