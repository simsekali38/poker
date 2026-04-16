import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  merge,
  of,
  switchMap,
  take,
} from 'rxjs';
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
  /** Shown after OAuth redirect (query cleared). */
  protected readonly jiraOAuthFeedback = signal<{ kind: 'success' | 'error'; text: string } | null>(null);

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
    deckPresetId: this.fb.control<DeckPresetId>('fibonacci', {
      validators: [Validators.required, this.deckPresetValidator],
    }),
    jiraSiteUrl: this.fb.control('https://migrosone.atlassian.net/', { validators: [this.optionalJiraSiteValidator] }),
    initialJiraIssueKey: this.fb.control('EVRST-', { validators: [this.optionalJiraIssueValidator] }),
    jiraOAuthCompleted: this.fb.control(false),
  });

  constructor() {
    merge(this.form.controls.initialJiraIssueKey.valueChanges, this.form.controls.jiraSiteUrl.valueChanges)
      .pipe(
        debounceTime(500),
        map(() => ({
          site: normalizeJiraSiteUrl(this.form.controls.jiraSiteUrl.value?.trim() ?? ''),
          key: parseJiraIssueKey(this.form.controls.initialJiraIssueKey.value),
        })),
        distinctUntilChanged(
          (a, b) =>
            a.site === b.site && a.key === b.key,
        ),
        filter(
          () =>
            this.jiraUiEnabled &&
            Boolean(environment.jiraBackendApiUrl?.trim()),
        ),
        filter(
          (x): x is { site: string; key: string } =>
            x.site !== null && x.key !== null,
        ),
        switchMap((x) =>
          this.jiraBackend.getIssue(x.key, x.site).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((issue) => {
        if (!issue) {
          return;
        }
        const summary = (issue.summary ?? '').trim();
        const storyTitle =
          summary.length >= 2
            ? summary.slice(0, 200)
            : summary.length === 1
              ? `${issue.issueKey}: ${summary}`.slice(0, 200)
              : issue.issueKey;
        const sessionRaw = summary ? `${issue.issueKey}: ${summary}` : issue.issueKey;
        const sessionTitle = sessionRaw.slice(0, 120);
        this.form.patchValue(
          { initialStoryTitle: storyTitle, },
          //{ initialStoryTitle: storyTitle, sessionTitle: sessionTitle },
          { emitEvent: false },
        );
      });
  }

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    const jiraError = q.get('jira_error');
    if (jiraError) {
      let text = jiraError;
      try {
        text = decodeURIComponent(jiraError);
      } catch {
        /* keep raw */
      }
      this.jiraOAuthFeedback.set({
        kind: 'error',
        text: this.formatJiraOAuthCallbackError(text),
      });
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      return;
    }

    const connected = q.get('jira_connected');
    let site = q.get('jira_site');
    if (site) {
      try {
        site = decodeURIComponent(site);
      } catch {
        /* keep raw */
      }
    }
    if (connected === '1' || connected === 'true') {
      const patch: { jiraSiteUrl?: string; jiraOAuthCompleted: boolean } = {
        jiraOAuthCompleted: true,
      };
      if (site?.trim()) {
        patch.jiraSiteUrl = site.trim();
      }
      this.form.patchValue(patch);
      this.jiraOAuthFeedback.set({
        kind: 'success',
        text: 'Jira connected. You can finish creating the session.',
      });
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
  }

  private formatJiraOAuthCallbackError(raw: string): string {
    const lower = raw.trim().toLowerCase();
    if (lower === 'access_denied') {
      return 'Jira authorization was cancelled.';
    }
    if (lower.includes('invalid_grant') || lower.includes('code')) {
      return 'Jira login failed or the link expired. Try Connect Jira again.';
    }
    return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
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
      error: () => {
        this.jiraOAuthBusy.set(false);
        this.jiraOAuthFeedback.set({
          kind: 'error',
          text: 'Could not start Jira login. Check that the API is reachable and you are signed in.',
        });
      },
    });
  }

  protected showJiraOAuthButton(): boolean {
    return this.jiraUiEnabled && Boolean(environment.jiraBackendApiUrl?.trim());
  }

  protected submit(): void {
    const formattedDate = new Date().toLocaleDateString('tr-TR');
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
        sessionTitle: raw.sessionTitle + ' - ' + formattedDate,
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
