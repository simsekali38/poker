import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { VoteCard } from '@app/core/models';
import { environment } from '@env/environment';
import { Observable, from, switchMap, throwError } from 'rxjs';

export interface JiraSyncVoteLine {
  readonly memberId: string;
  readonly displayName: string;
  readonly card: string;
}

export interface JiraSyncParticipantLine {
  readonly memberId: string;
  readonly displayName: string;
}

export interface SendFinalEstimatePayload {
  readonly sessionId: string;
  readonly storyId: string;
  readonly storyTitle: string;
  readonly estimate: VoteCard;
  readonly method: string;
  readonly jiraIssueKey: string;
  readonly jiraSiteUrl: string | null;
  readonly jiraBoardId?: string | null;
  /** When set, issue is moved to this Jira Software sprint after story points are written. */
  readonly sprintId?: number | null;
  readonly includeComment?: boolean;
  readonly votes: readonly JiraSyncVoteLine[];
  readonly participants: readonly JiraSyncParticipantLine[];
}

export interface SyncEstimateResponse {
  ok: boolean;
  firestoreUpdated?: boolean;
}

export interface JiraBoardSprintRow {
  readonly id: number;
  readonly name: string;
  readonly state: string;
  readonly originBoardId?: number;
}

export interface JiraBoardSprintsResponse {
  readonly board: { readonly id: number; readonly name: string };
  readonly sprints: readonly JiraBoardSprintRow[];
}

export interface JiraBoardListRow {
  readonly id: number;
  readonly name: string;
  readonly type: string;
}

export interface JiraBoardsForProjectResponse {
  readonly boards: readonly JiraBoardListRow[];
}

/**
 * Calls the backend Jira sync endpoint (`POST /jira/sync-estimate`) with a Firebase ID token.
 */
@Injectable({ providedIn: 'root' })
export class JiraPlanningIntegrationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  sendFinalEstimate(payload: SendFinalEstimatePayload): Observable<SyncEstimateResponse> {
    const base = environment.jiraBackendApiUrl?.replace(/\/$/, '') ?? '';
    if (!environment.jiraIntegrationEnabled || !base) {
      return throwError(() => new Error('Jira integration is not configured'));
    }
    return from(this.auth.currentUser?.getIdToken() ?? Promise.resolve(null)).pipe(
      switchMap((token) => {
        if (!token) {
          return throwError(() => new Error('Sign in required'));
        }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        return this.http.post<SyncEstimateResponse>(`${base}/jira/sync-estimate`, payload, {
          headers,
        });
      }),
    );
  }

  /** GET /jira/boards — boards for a project key (derived from issue key). */
  listBoardsForProject(jiraSiteUrl: string, projectKey: string): Observable<JiraBoardsForProjectResponse> {
    const base = environment.jiraBackendApiUrl?.replace(/\/$/, '') ?? '';
    if (!environment.jiraIntegrationEnabled || !base) {
      return throwError(() => new Error('Jira integration is not configured'));
    }
    const params = new HttpParams().set('siteUrl', jiraSiteUrl).set('projectKey', projectKey);
    return from(this.auth.currentUser?.getIdToken() ?? Promise.resolve(null)).pipe(
      switchMap((token) => {
        if (!token) {
          return throwError(() => new Error('Sign in required'));
        }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        return this.http.get<JiraBoardsForProjectResponse>(`${base}/jira/boards`, {
          headers,
          params,
        });
      }),
    );
  }

  /** GET /jira/board-sprints — requires session Scrum board id and linked Jira site. */
  listBoardSprints(jiraSiteUrl: string, boardId: string): Observable<JiraBoardSprintsResponse> {
    const base = environment.jiraBackendApiUrl?.replace(/\/$/, '') ?? '';
    if (!environment.jiraIntegrationEnabled || !base) {
      return throwError(() => new Error('Jira integration is not configured'));
    }
    const params = new HttpParams().set('siteUrl', jiraSiteUrl).set('boardId', boardId);
    return from(this.auth.currentUser?.getIdToken() ?? Promise.resolve(null)).pipe(
      switchMap((token) => {
        if (!token) {
          return throwError(() => new Error('Sign in required'));
        }
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        return this.http.get<JiraBoardSprintsResponse>(`${base}/jira/board-sprints`, {
          headers,
          params,
        });
      }),
    );
  }
}
