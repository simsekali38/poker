import { env } from '../config/env.js';

export interface AccessibleResource {
  id: string;
  url: string;
  name: string;
}

export async function fetchAccessibleResources(accessToken: string): Promise<AccessibleResource[]> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`accessible-resources failed: ${res.status} ${t}`);
  }
  return res.json() as Promise<AccessibleResource[]>;
}

export function resolveCloudId(resources: AccessibleResource[], siteUrl: string): string {
  let origin: string;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    throw new Error('Invalid jiraSiteUrl');
  }
  const hit = resources.find((r) => {
    try {
      return new URL(r.url).origin === origin;
    } catch {
      return false;
    }
  });
  if (hit) {
    return hit.id;
  }
  if (resources.length === 1) {
    return resources[0].id;
  }
  throw new Error(
    'Could not match jiraSiteUrl to an Atlassian Cloud site for this account. Grant access to that site or set jiraSiteUrl to one of your accessible sites.',
  );
}

export function pickDefaultSiteUrl(resources: AccessibleResource[]): string | null {
  if (resources.length === 0) {
    return null;
  }
  return resources[0].url;
}
