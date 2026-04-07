import { Component, input } from '@angular/core';

/**
 * Standard session shell: white surface, rounded-2xl, soft border, shadow, padding.
 * Use either `title` + optional `[uiPanelActions]` or a full `[uiPanelHeader]` block.
 */
@Component({
  selector: 'app-ui-panel',
  standalone: true,
  template: `
    <section
      class="ui-panel"
      [class.ui-panel--hover]="hover()"
      [class.ui-panel--compact]="compact()"
      [attr.aria-labelledby]="title() ? resolvedHeadingId : null"
      [attr.aria-busy]="ariaBusy() ? 'true' : null"
    >
      @if (title()) {
        <header class="ui-panel__header">
          <h2 class="ui-section-title ui-panel__title" [id]="resolvedHeadingId">{{ title() }}</h2>
          <div class="ui-panel__actions">
            <ng-content select="[uiPanelActions]" />
          </div>
        </header>
      } @else {
        <ng-content select="[uiPanelHeader]" />
      }
      <div class="ui-panel__body">
        <ng-content />
      </div>
    </section>
  `,
})
export class UiPanelComponent {
  private static seq = 0;
  private readonly instanceId = ++UiPanelComponent.seq;

  /** When set, builds the standard header row (title + projected actions). */
  readonly title = input('');
  /** Preferred stable id for the built-in title heading (a fallback is generated per instance). */
  readonly labelledBy = input<string | undefined>(undefined);
  /** Subtle lift on hover (cards that are clickable-feeling). */
  readonly hover = input(false);
  /** Smaller padding (sidebar cells). */
  readonly compact = input(false);
  /** Busy state for live regions (e.g. story list loading). */
  readonly ariaBusy = input(false);

  protected get resolvedHeadingId(): string {
    return this.labelledBy()?.trim() || `ui-panel-heading-${this.instanceId}`;
  }
}
