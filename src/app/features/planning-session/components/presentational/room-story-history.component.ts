import { Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { JiraBackendService } from '@app/core/services/jira-backend.service';
import { UiButtonDirective, UiPanelComponent, UiPanelHeaderDirective } from '@app/shared/ui/design-system';
import { parseJiraIssueKey } from '@app/shared/utils/jira-issue-key.utils';
import { environment } from '@env/environment';
import { finalize } from 'rxjs';
import { StoryHistoryRowVm } from '../../models/planning-room.view-model';

@Component({
  selector: 'app-room-story-history',
  standalone: true,
  imports: [ReactiveFormsModule, UiButtonDirective, UiPanelComponent, UiPanelHeaderDirective],
  templateUrl: './room-story-history.component.html',
  styleUrl: './room-story-history.component.scss',
})
export class RoomStoryHistoryComponent {
  private readonly jiraBackend = inject(JiraBackendService);

  /** Exposed for template (Jira hint when integration is on but session has no site URL). */
  protected readonly env = environment;

  readonly rows = input.required<StoryHistoryRowVm[]>();
  readonly isModerator = input(false);
  readonly busy = input(false);
  /** Session Jira Cloud site URL (normalized). */
  readonly jiraSiteUrl = input<string | null>(null);
  /** Env + session allow loading issue by key. */
  readonly jiraStoryImportAvailable = input(false);

  readonly switchStory = output<string>();
  readonly createStory = output<{
    title: string;
    description: string;
    makeActive: boolean;
    jiraIssueKey?: string | null;
  }>();

  protected readonly addFormOpen = signal(false);
  protected readonly jiraLoadBusy = signal(false);
  protected readonly jiraLoadMessage = signal<string | null>(null);
  protected readonly loadedJiraIssueKey = signal<string | null>(null);

  readonly jiraKeyDraft = new FormControl('', { nonNullable: true });

  protected toggleAddForm(): void {
    const opening = !this.addFormOpen();
    this.addFormOpen.update((open) => !open);
    if (opening) {
      this.jiraLoadMessage.set(null);
      this.loadedJiraIssueKey.set(null);
      this.jiraKeyDraft.setValue('');
    }
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

  protected fetchFromJira(): void {
    if (!this.jiraStoryImportAvailable() || this.busy() || this.jiraLoadBusy()) {
      return;
    }
    const site = this.jiraSiteUrl()?.trim() ?? '';
    const raw = this.jiraKeyDraft.value.trim();
    const key = parseJiraIssueKey(raw);
    if (!key) {
      this.jiraLoadMessage.set('Enter a valid Jira issue key (e.g. EVRST-1386).');
      return;
    }
    if (!site) {
      this.jiraLoadMessage.set('Add a Jira site URL in session settings first.');
      return;
    }
    if (!environment.jiraBackendApiUrl?.trim()) {
      this.jiraLoadMessage.set('Jira backend is not configured.');
      return;
    }
    this.jiraLoadBusy.set(true);
    this.jiraLoadMessage.set(null);
    this.jiraBackend
      .getIssue(key, site)
      .pipe(finalize(() => this.jiraLoadBusy.set(false)))
      .subscribe({
        next: (issue) => {
          this.createForm.patchValue({
            title: issue.summary,
            description: issue.description ?? '',
          });
          this.loadedJiraIssueKey.set(issue.issueKey);
          this.jiraLoadMessage.set(`Loaded ${issue.issueKey}.`);
        },
        error: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.jiraLoadMessage.set(msg || 'Could not load issue from Jira.');
          this.loadedJiraIssueKey.set(null);
        },
      });
  }

  /** Unlock issue key and clear loaded fields so another key can be entered. */
  protected clearJiraLoad(): void {
    if (this.busy() || this.jiraLoadBusy()) {
      return;
    }
    this.loadedJiraIssueKey.set(null);
    this.jiraLoadMessage.set(null);
    this.jiraKeyDraft.setValue('');
    this.createForm.patchValue({ title: '', description: '' });
  }

  protected submitNew(): void {
    if (this.jiraStoryImportAvailable() && !this.loadedJiraIssueKey()) {
      this.jiraLoadMessage.set('Load an issue from Jira before creating the story.');
      return;
    }
    if (!this.isModerator() || this.busy() || this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const title = this.createForm.controls.title.value.trim();
    const description = this.createForm.controls.description.value.trim();
    const makeActive = this.createForm.controls.makeActive.value;
    const jiraIssueKey = this.loadedJiraIssueKey();
    this.createStory.emit({
      title,
      description,
      makeActive,
      jiraIssueKey: jiraIssueKey ?? null,
    });
    this.createForm.reset({ title: '', description: '', makeActive: true });
    this.jiraKeyDraft.setValue('');
    this.loadedJiraIssueKey.set(null);
    this.jiraLoadMessage.set(null);
  }
}
