import { Component, input, output } from '@angular/core';
import { UiButtonDirective } from '@app/shared/ui/design-system';

@Component({
  selector: 'app-planning-room-error-banner',
  standalone: true,
  imports: [UiButtonDirective],
  template: `
    @if (message(); as err) {
      <div class="banner banner--error" role="alert">
        <span class="banner__text">{{ err }}</span>
        <button type="button" uiBtn="secondary" uiBtnSize="sm" (click)="dismiss.emit()">Dismiss</button>
      </div>
    }
  `,
  styleUrl: './planning-room-error-banner.component.scss',
})
export class PlanningRoomErrorBannerComponent {
  readonly message = input<string | null>(null);
  readonly dismiss = output<void>();
}
