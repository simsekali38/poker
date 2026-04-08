import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { consumeOAuthState, createOAuthState } from '../lib/oauthStateStore.js';
import type { AuthedRequest } from '../middleware/requireFirebaseAuth.js';
import { requireFirebaseAuth } from '../middleware/requireFirebaseAuth.js';
import { exchangeAuthorizationCode, saveTokensForUser } from '../services/jiraUserTokenService.js';
import { pickDefaultSiteUrl, fetchAccessibleResources } from '../services/jiraSiteService.js';

const router = Router();

const startBody = z.object({
  returnUrl: z.string().url(),
});

/**
 * POST /jira/oauth/start
 * Returns Atlassian authorize URL (frontend navigates to it).
 */
router.post('/oauth/start', requireFirebaseAuth, (req, res) => {
  const parsed = startBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const uid = (req as AuthedRequest).firebaseUid;
  const state = createOAuthState({ firebaseUid: uid, returnUrl: parsed.data.returnUrl });
  const scopes = encodeURIComponent(env.ATLASSIAN_SCOPES.replace(/\s+/g, ' '));
  const redirect = encodeURIComponent(env.ATLASSIAN_OAUTH_REDIRECT_URI);
  const clientId = encodeURIComponent(env.ATLASSIAN_CLIENT_ID);
  const authorizeUrl =
    `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${clientId}` +
    `&scope=${scopes}&redirect_uri=${redirect}&response_type=code&prompt=consent&state=${encodeURIComponent(
      state,
    )}`;
  res.json({ redirectUrl: authorizeUrl });
});

/**
 * GET /jira/oauth/callback — browser redirect from Atlassian
 */
router.get('/oauth/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !state) {
    res.status(400).send('Missing code or state');
    return;
  }
  const st = consumeOAuthState(state);
  if (!st) {
    res.status(400).send('Invalid or expired OAuth state');
    return;
  }
  try {
    const tr = await exchangeAuthorizationCode(code);
    const access = tr.access_token;
    const refresh = tr.refresh_token ?? null;
    const exp = tr.expires_in ?? 3600;

    let atlassianAccountId: string | null = null;
    try {
      const me = await fetch('https://api.atlassian.com/me', {
        headers: { Authorization: `Bearer ${access}` },
      });
      if (me.ok) {
        const j = (await me.json()) as { account_id?: string };
        atlassianAccountId = j.account_id ?? null;
      }
    } catch {
      /* optional */
    }

    await saveTokensForUser(st.firebaseUid, access, refresh, exp, atlassianAccountId);

    const resources = await fetchAccessibleResources(access);
    const site = pickDefaultSiteUrl(resources);
    const url = new URL(st.returnUrl);
    url.searchParams.set('jira_connected', '1');
    if (site) {
      url.searchParams.set('jira_site', site);
    }
    res.redirect(url.toString());
  } catch (e) {
    console.error(e);
    res.status(500).send('OAuth callback failed');
  }
});

export { router as jiraOAuthRouter };
