import { Directive, HostBinding, HostListener, input } from '@angular/core';

export type UiButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Design-system button: `styles.scss` `.ui-btn*`. Sizes sm | md | lg; `uiBtnLoading` shows spinner
 * (pair with `[disabled]` when async work should block submits).
 */
@Directive({
  selector: 'button[uiBtn]',
  standalone: true,
  host: {
    class: 'ui-btn',
  },
})
export class UiButtonDirective {
  readonly uiBtn = input<UiButtonVariant>('primary');
  readonly uiBtnSize = input<'sm' | 'md' | 'lg'>('md');
  readonly uiBtnLoading = input(false);

  @HostBinding('class.ui-btn--sm')
  protected get sizeSm(): boolean {
    return this.uiBtnSize() === 'sm';
  }

  @HostBinding('class.ui-btn--md')
  protected get sizeMd(): boolean {
    return this.uiBtnSize() === 'md';
  }

  @HostBinding('class.ui-btn--lg')
  protected get sizeLg(): boolean {
    return this.uiBtnSize() === 'lg';
  }

  @HostBinding('class.ui-btn--loading')
  protected get loading(): boolean {
    return this.uiBtnLoading();
  }

  @HostBinding('class.ui-btn--primary')
  protected get variantPrimary(): boolean {
    return this.uiBtn() === 'primary';
  }

  @HostBinding('class.ui-btn--secondary')
  protected get variantSecondary(): boolean {
    return this.uiBtn() === 'secondary';
  }

  @HostBinding('class.ui-btn--ghost')
  protected get variantGhost(): boolean {
    return this.uiBtn() === 'ghost';
  }

  @HostBinding('class.ui-btn--danger')
  protected get variantDanger(): boolean {
    return this.uiBtn() === 'danger';
  }

  @HostListener('click', ['$event'])
  protected blockClickWhenLoading(event: Event): void {
    if (this.uiBtnLoading()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
