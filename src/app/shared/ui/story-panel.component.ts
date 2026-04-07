import { Component, input, output } from '@angular/core';
import { Story } from '@app/core/models';
import { UiButtonDirective } from '@app/shared/ui/design-system';

@Component({
  selector: 'app-story-panel',
  standalone: true,
  imports: [UiButtonDirective],
  templateUrl: './story-panel.component.html',
  styleUrl: './story-panel.component.scss',
})
export class StoryPanelComponent {
  readonly story = input<Story | null>(null);
  readonly canEdit = input(false);
  readonly editRequest = output<void>();

  protected requestEdit(): void {
    if (this.canEdit()) {
      this.editRequest.emit();
    }
  }
}
