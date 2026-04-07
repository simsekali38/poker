import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Auth } from '@angular/fire/auth';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  catchError,
  distinctUntilChanged,
  EMPTY,
  finalize,
  map,
  switchMap,
  take,
  tap,
} from 'rxjs';
import { SessionLocalIdentityService } from '@app/core/services/session-local-identity.service';
import { formatSessionCodeForDisplay } from '@app/shared/utils/session-code.utils';
import { isFirebasePermissionDenied } from '@app/core/utils/firebase-error.utils';
import { AutofocusDirective } from '@app/shared/directives/autofocus.directive';
import { isJoinFlowError } from '../models/join-flow-error';
import { SessionJoinFacade } from '../services/session-join.facade';

export type JoinPageLoadState =
  | 'loading'
  | 'ready'
  | 'not_found'
  | 'closed'
  | 'error'
  | 'invalid_id';

@Component({
  selector: 'app-session-join-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AutofocusDirective],
  templateUrl: './session-join-page.component.html',
  styleUrl: './session-join-page.component.scss',
})
export class SessionJoinPageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly joinFacade = inject(SessionJoinFacade);
  private readonly localIdentity = inject(SessionLocalIdentityService);
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sessionId = signal<string>('');
  protected readonly loadState = signal<JoinPageLoadState>('loading');
  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    displayName: this.fb.control('', {
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(64)],
    }),
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((p) => p.get('sessionId')?.trim() ?? ''),
        distinctUntilChanged(),
        tap((id) => {
          this.sessionId.set(id);
          this.submitError.set(null);
          if (!id) {
            this.loadState.set('invalid_id');
          } else {
            this.loadState.set('loading');
          }
        }),
        switchMap((id) => {
          if (!id) {
            return EMPTY;
          }
          return this.joinFacade.validateSessionForJoinPage(id).pipe(
            tap({
              next: () => {
                this.loadState.set('ready');
                this.prefillDisplayName(id);
              },
            }),
            catchError((e: unknown) => {
              if (isJoinFlowError(e)) {
                this.loadState.set(e.code === 'closed' ? 'closed' : 'not_found');
              } else {
                this.loadState.set('error');
              }
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected formatSessionCode(id: string): string {
    return formatSessionCodeForDisplay(id);
  }

  private prefillDisplayName(sessionId: string): void {
    const uid = this.auth.currentUser?.uid;
    const binding = this.localIdentity.readBinding(sessionId);
    if (uid && binding?.memberId === uid && binding.displayName) {
      this.form.patchValue({ displayName: binding.displayName });
    }
  }

  protected join(): void {
    const id = this.sessionId();
    this.submitError.set(null);
    if (this.form.invalid || !id || this.loadState() !== 'ready') {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isSubmitting()) {
      return;
    }
    this.isSubmitting.set(true);
    const name = this.form.getRawValue().displayName;
    this.joinFacade
      .join(id, name)
      .pipe(
        take(1),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe({
        next: () => void this.router.navigate(['/session', id]),
        error: (err: unknown) => this.submitError.set(this.formatJoinSubmitError(err)),
      });
  }

  private formatJoinSubmitError(err: unknown): string {
    if (isJoinFlowError(err)) {
      return err.code === 'closed'
        ? 'This session is closed and no longer accepts participants.'
        : 'This session could not be found. Check the session ID and try again.';
    }
    if (isFirebasePermissionDenied(err)) {
      return 'Permission denied. Check Firestore rules for members/{yourUid} writes.';
    }
    return 'Could not join the session. Please try again.';
  }
}
