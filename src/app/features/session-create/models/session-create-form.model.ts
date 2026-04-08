import { DeckPresetId } from '@app/core/models';

export interface SessionCreateFormValue {
  sessionTitle: string;
  moderatorDisplayName: string;
  initialStoryTitle: string;
  deckPresetId: DeckPresetId;
  /** Optional Jira Cloud site URL. */
  jiraSiteUrl: string;
  /** Optional issue key for the first story. */
  initialJiraIssueKey: string;
  /** Set after OAuth redirect with `jira_connected` + `jira_site`. */
  jiraOAuthCompleted: boolean;
}
