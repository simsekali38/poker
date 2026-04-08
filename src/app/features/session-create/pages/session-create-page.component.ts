import { Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, take } from 'rxjs';
import { DeckPresetId } from '@app/core/models';
import { AutofocusDirective } from '@app/shared/directives/autofocus.directive';
import { DECK_PRESET_OPTIONS, isKnownDeckPresetId } from '@app/shared/utils/deck-presets';
import { getFirebaseErrorCode } from '@app/core/utils/firebase-error.utils';
import { parseJiraIssueKey } from '@app/shared/utils/jira-issue-key.utils';
import { normalizeJiraSiteUrl } from '@app/shared/utils/jira-site.utils';
import { JiraBackendService } from '@app/core/services/jira-backend.service';
import { environment } from '@env/environment';
import { SessionCreateFacade } from '../services/session-create.facade';

@Component({
  selector: 'app-session-create-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AutofocusDirective],
  templateUrl: './session-create-page.component.html',
  styleUrl: './session-create-page.component.scss',
})
export class SessionCreatePageComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sessionCreate = inject(SessionCreateFacade);
  private readonly jiraBackend = inject(JiraBackendService);

  private readonly deckPresetValidator = (control: AbstractControl): ValidationErrors | null => {
    const v = control.value;
    if (typeof v !== 'string' || !isKnownDeckPresetId(v)) {
      return { unknownDeck: true };
    }
    return null;
  };

  private readonly optionalJiraSiteValidator = (control: AbstractControl): ValidationErrors | null => {
    const v = typeof control.value === 'string' ? control.value.trim() : '';
    if (!v) {
      return null;
    }
    return normalizeJiraSiteUrl(v) ? null : { jiraSite: true };
  };

  private readonly optionalJiraIssueValidator = (control: AbstractControl): ValidationErrors | null => {
    const v = typeof control.value === 'string' ? control.value.trim() : '';
    if (!v) {
      return null;
    }
    return parseJiraIssueKey(v) ? null : { jiraIssue: true };
  };

  protected readonly deckOptions = DECK_PRESET_OPTIONS;
  protected readonly jiraUiEnabled = environment.jiraIntegrationEnabled;
  protected readonly isSubmitting = signal(false);
  protected readonly jiraOAuthBusy = signal(false);
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
    jiraSiteUrl: this.fb.control('https://migrosone.atlassian.net/', { validators: [this.optionalJiraSiteValidator] }),
    initialJiraIssueKey: this.fb.control('', { validators: [this.optionalJiraIssueValidator] }),
    jiraOAuthCompleted: this.fb.control(false),
  });

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const connected = q.get('jira_connected');
    let site = q.get('jira_site');
    if (site) {
      try {
        site = decodeURIComponent(site);
      } catch {
        /* keep raw */
      }
    }
    if ((connected === '1' || connected === 'true') && site?.trim()) {
      this.form.patchValue({ jiraSiteUrl: site.trim(), jiraOAuthCompleted: true });
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  /** POST /jira/oauth/start then full-page redirect to Atlassian. */
  protected startJiraOAuth(): void {
    if (!environment.jiraBackendApiUrl?.trim() || this.jiraOAuthBusy()) {
      return;
    }
    const returnUrl = `${globalThis.location.origin}/session/create`;
    this.jiraOAuthBusy.set(true);
    this.jiraBackend.startOAuth(returnUrl).subscribe({
      next: (r) => globalThis.location.assign(r.redirectUrl),
      error: () => this.jiraOAuthBusy.set(false),
    });
  }

  protected showJiraOAuthButton(): boolean {
    return this.jiraUiEnabled && Boolean(environment.jiraBackendApiUrl?.trim());
  }

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
        jiraSiteUrl: raw.jiraSiteUrl,
        initialJiraIssueKey: raw.initialJiraIssueKey,
        jiraOAuthCompleted: raw.jiraOAuthCompleted,
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
