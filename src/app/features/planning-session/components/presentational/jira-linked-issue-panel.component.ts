import { Component, effect, inject, input, signal } from '@angular/core';
import { JiraBackendService, JiraIssuePreviewDto } from '@app/core/services/jira-backend.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-jira-linked-issue-panel',
  standalone: true,
  templateUrl: './jira-linked-issue-panel.component.html',
  styleUrl: './jira-linked-issue-panel.component.scss',
})
export class JiraLinkedIssuePanelComponent {
  private readonly jira = inject(JiraBackendService);

  readonly issueKey = input<string | null>(null);
  readonly siteUrl = input<string | null>(null);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly issue = signal<JiraIssuePreviewDto | null>(null);

  constructor() {
    effect((onCleanup) => {
      if (!environment.jiraIntegrationEnabled || !environment.jiraBackendApiUrl?.trim()) {
        this.issue.set(null);
        this.error.set(null);
        this.loading.set(false);
        return;
      }
      const k = this.issueKey()?.trim() ?? '';
      const s = this.siteUrl()?.trim() ?? '';
      if (!k || !s) {
        this.issue.set(null);
        this.error.set(null);
        this.loading.set(false);
        return;
      }
      this.loading.set(true);
      this.error.set(null);
      const sub = this.jira.getIssue(k, s).subscribe({
        next: (d) => {
          this.issue.set(d);
          this.loading.set(false);
          this.error.set(null);
        },
        error: (e: unknown) => {
          this.issue.set(null);
          this.loading.set(false);
          this.error.set(e instanceof Error ? e.message : 'Could not load Jira issue.');
        },
      });
      onCleanup(() => sub.unsubscribe());
    });
  }
}
