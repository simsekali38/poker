import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';
import { DeckPresetId } from '@app/core/models';
import { AutofocusDirective } from '@app/shared/directives/autofocus.directive';
import { DECK_PRESET_OPTIONS, isKnownDeckPresetId } from '@app/shared/utils/deck-presets';
import { getFirebaseErrorCode } from '@app/core/utils/firebase-error.utils';
import { SessionCreateFacade } from '../services/session-create.facade';

@Component({
  selector: 'app-session-create-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AutofocusDirective],
  templateUrl: './session-create-page.component.html',
  styleUrl: './session-create-page.component.scss',
})
export class SessionCreatePageComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly sessionCreate = inject(SessionCreateFacade);

  private readonly deckPresetValidator = (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (typeof v !== 'string' || !isKnownDeckPresetId(v)) {
      return { unknownDeck: true };
    }
    return null;
  };

  protected readonly deckOptions = DECK_PRESET_OPTIONS;
  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    sessionTitle: this.fb.control('', {
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    moderatorDisplayName: this.fb.control('', {
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(64)],
    }),
    initialStoryTitle: this.fb.control('', {
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
    }),
    deckPresetId: this.fb.control<DeckPresetId>('classic', {
      validators: [Validators.required, this.deckPresetValidator],
    }),
  });

  protected submit(): void {
    this.submitError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isSubmitting()) {
      return;
    }
    this.isSubmitting.set(true);
    const raw = this.form.getRawValue();
    this.sessionCreate
      .create({
        sessionTitle: raw.sessionTitle,
        moderatorDisplayName: raw.moderatorDisplayName,
        initialStoryTitle: raw.initialStoryTitle,
        deckPresetId: raw.deckPresetId,
      })
      .pipe(
        take(1),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe({
        next: (sessionId) => void this.router.navigate(['/session', sessionId]),
        error: (err: unknown) => this.submitError.set(this.formatError(err)),
      });
  }

  private formatError(err: unknown): string {
    const code = getFirebaseErrorCode(err);
    if (code === 'permission-denied') {
      return 'Permission denied. Enable Anonymous sign-in and update Firestore rules so authenticated users can create sessions.';
    }
    if (code === 'unavailable') {
      return 'Network unavailable. Check your connection and try again.';
    }
    return 'Could not create the session. Please try again.';
  }
}
