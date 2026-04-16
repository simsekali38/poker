import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { environment } from '@env/environment';
import { Observable, from, of, switchMap, throwError } from 'rxjs';

/** Matches `server` GET /jira/issues/:issueKey response. */
export interface JiraIssuePreviewDto {
  issueKey: string;
  issueId: string;
  summary: string;
  description: string | null;
  status: { id: string; name: string; category?: string };
  assignee: { accountId: string; displayName: string; emailAddress: string | null } | null;
  /** Set when `includeCurrentSprint` was requested: Agile sprint id (active, else future). */
  currentSprintId?: number | null;
}

@Injectable({ providedIn: 'root' })
export class JiraBackendService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  private get base(): string {
    return environment.jiraBackendApiUrl?.replace(/\/$/, '') ?? '';
  }

  private authorizedHeaders(): Observable<HttpHeaders> {
    return from(this.auth.currentUser?.getIdToken() ?? Promise.resolve(null)).pipe(
      switchMap((token) => {
        if (!token) {
          return throwError(() => new Error('Sign in required to use Jira.'));
        }
        return of(new HttpHeaders({ Authorization: `Bearer ${token}` }));
      }),
    );
  }

  /** POST /jira/oauth/start — returns Atlassian authorize URL. */
  startOAuth(returnUrl: string): Observable<{ redirectUrl: string }> {
    if (!this.base) {
      return throwError(() => new Error('Jira backend URL is not configured'));
    }
    return this.authorizedHeaders().pipe(
      switchMap((headers) =>
        this.http.post<{ redirectUrl: string }>(
          `${this.base}/jira/oauth/start`,
          { returnUrl },
          { headers },
        ),
      ),
    );
  }

  /** GET /jira/issues/:issueKey */
  getIssue(
    issueKey: string,
    siteUrl: string,
    options?: { readonly includeCurrentSprint?: boolean },
  ): Observable<JiraIssuePreviewDto> {
    if (!this.base) {
      return throwError(() => new Error('Jira backend URL is not configured'));
    }
    let params = new HttpParams().set('siteUrl', siteUrl);
    if (options?.includeCurrentSprint) {
      params = params.set('includeCurrentSprint', 'true');
    }
    return this.authorizedHeaders().pipe(
      switchMap((headers) =>
        this.http.get<JiraIssuePreviewDto>(`${this.base}/jira/issues/${encodeURIComponent(issueKey)}`, {
          params,
          headers,
        }),
      ),
    );
  }
}
