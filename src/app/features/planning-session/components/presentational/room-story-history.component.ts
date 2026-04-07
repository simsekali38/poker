import { Component, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { StoryHistoryRowVm } from '../../models/planning-room.view-model';

@Component({
  selector: 'app-room-story-history',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './room-story-history.component.html',
  styleUrl: './room-story-history.component.scss',
})
export class RoomStoryHistoryComponent {
  readonly rows = input.required<StoryHistoryRowVm[]>();
  readonly isModerator = input(false);
  readonly busy = input(false);

  readonly switchStory = output<string>();
  readonly createStory = output<{ title: string; description: string; makeActive: boolean }>();

  protected readonly addFormOpen = signal(false);

  protected toggleAddForm(): void {
    this.addFormOpen.update((open) => !open);
  }

  readonly createForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    makeActive: new FormControl(true, { nonNullable: true }),
  });

  protected formatAverage(value: number | null): string {
    if (value === null) {
      return '—';
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  protected onSwitch(row: StoryHistoryRowVm): void {
    if (!this.isModerator() || this.busy() || row.isActive) {
      return;
    }
    this.switchStory.emit(row.id);
  }

  protected submitNew(): void {
    if (!this.isModerator() || this.busy() || this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const title = this.createForm.controls.title.value.trim();
    const description = this.createForm.controls.description.value.trim();
    const makeActive = this.createForm.controls.makeActive.value;
    this.createStory.emit({ title, description, makeActive });
    this.createForm.reset({ title: '', description: '', makeActive: true });
  }
}
