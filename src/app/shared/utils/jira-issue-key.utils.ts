/** Normalizes and validates a Jira issue key (`PROJ-123`). Returns `null` if invalid. */
export function parseJiraIssueKey(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const s = raw.trim().toUpperCase();
  if (s.length < 3) {
    return null;
  }
  // Typical Jira project key + numeric id
  if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(s)) {
    return null;
  }
  return s;
}
