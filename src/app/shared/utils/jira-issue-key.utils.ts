/** Normalizes and validates a Jira issue key (`EVRST-1386`). Returns `null` if invalid. */
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

/** Project key from a valid issue key, e.g. `EVRST-1386` → `EVRST`. */
export function parseJiraProjectKeyFromIssue(raw: string | null | undefined): string | null {
  const k = parseJiraIssueKey(raw);
  if (!k) {
    return null;
  }
  const lastHyphen = k.lastIndexOf('-');
  if (lastHyphen <= 0) {
    return null;
  }
  const suffix = k.slice(lastHyphen + 1);
  if (!/^\d+$/.test(suffix)) {
    return null;
  }
  return k.slice(0, lastHyphen);
}
