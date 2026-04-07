import { Component, ElementRef, output, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-story-edit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './story-edit-dialog.component.html',
  styleUrl: './story-edit-dialog.component.scss',
})
export class StoryEditDialogComponent {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly saved = output<{ title: string; description: string }>();
  readonly cancelled = output<void>();

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
  });

  open(initial: { title: string; description: string }): void {
    this.form.setValue({ title: initial.title, description: initial.description });
    queueMicrotask(() => this.dialog().nativeElement.showModal());
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.onCancel();
    }
  }

  protected onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const title = this.form.controls.title.value.trim();
    const description = this.form.controls.description.value.trim();
    if (!title) {
      return;
    }
    this.saved.emit({ title, description });
    this.close();
  }

  protected onCancel(): void {
    this.cancelled.emit();
    this.close();
  }

  private close(): void {
    this.dialog().nativeElement.close();
  }
}
