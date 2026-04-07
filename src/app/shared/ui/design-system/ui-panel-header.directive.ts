import { Directive } from '@angular/core';

/** Marks a block as the full custom header inside `app-ui-panel` (use when `title` is not enough). */
@Directive({
  selector: '[uiPanelHeader]',
  standalone: true,
  host: { class: 'ui-panel__header' },
})
export class UiPanelHeaderDirective {}
