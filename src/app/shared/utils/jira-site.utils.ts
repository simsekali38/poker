/** Normalizes a Jira Cloud site to `origin` (https://team.atlassian.net). Returns `null` if invalid. */
export function normalizeJiraSiteUrl(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const t = raw.trim();
  if (!t) {
    return null;
  }
  try {
    const u = new URL(t.startsWith('http://') || t.startsWith('https://') ? t : `https://${t}`);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return null;
    }
    return u.origin;
  } catch {
    return null;
  }
}
