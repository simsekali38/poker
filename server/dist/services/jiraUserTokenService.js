import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { decryptString, encryptString } from '../lib/cryptoSecret.js';
const prisma = new PrismaClient();
const REFRESH_WINDOW_MS = 5 * 60 * 1000;
async function refreshAccessToken(refreshToken) {
    const body = {
        grant_type: 'refresh_token',
        client_id: env.ATLASSIAN_CLIENT_ID,
        client_secret: env.ATLASSIAN_CLIENT_SECRET,
        refresh_token: refreshToken,
    };
    const res = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Token refresh failed: ${res.status} ${t}`);
    }
    return res.json();
}
export async function saveTokensForUser(firebaseUid, accessToken, refreshToken, expiresInSec, atlassianAccountId) {
    const expiresAt = new Date(Date.now() + expiresInSec * 1000);
    await prisma.jiraUserToken.upsert({
        where: { firebaseUid },
        create: {
            firebaseUid,
            atlassianAccountId,
            accessTokenEnc: encryptString(accessToken),
            refreshTokenEnc: refreshToken ? encryptString(refreshToken) : null,
            expiresAt,
        },
        update: {
            atlassianAccountId: atlassianAccountId ?? undefined,
            accessTokenEnc: encryptString(accessToken),
            refreshTokenEnc: refreshToken ? encryptString(refreshToken) : undefined,
            expiresAt,
        },
    });
}
export async function getValidAccessToken(firebaseUid) {
    const row = await prisma.jiraUserToken.findUnique({ where: { firebaseUid } });
    if (!row) {
        throw new Error('Jira is not connected for this user. Use Connect Jira first.');
    }
    let accessToken = decryptString(row.accessTokenEnc);
    const expiresAtMs = row.expiresAt.getTime();
    if (expiresAtMs - Date.now() > REFRESH_WINDOW_MS) {
        return accessToken;
    }
    if (!row.refreshTokenEnc) {
        throw new Error('Access token expired and no refresh token is stored. Reconnect Jira.');
    }
    const refreshToken = decryptString(row.refreshTokenEnc);
    const tr = await refreshAccessToken(refreshToken);
    accessToken = tr.access_token;
    const newRefresh = tr.refresh_token ?? refreshToken;
    const expSec = tr.expires_in ?? 3600;
    await saveTokensForUser(firebaseUid, accessToken, newRefresh, expSec, row.atlassianAccountId);
    return accessToken;
}
export async function exchangeAuthorizationCode(code) {
    const body = {
        grant_type: 'authorization_code',
        client_id: env.ATLASSIAN_CLIENT_ID,
        client_secret: env.ATLASSIAN_CLIENT_SECRET,
        code,
        redirect_uri: env.ATLASSIAN_OAUTH_REDIRECT_URI,
    };
    const res = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Code exchange failed: ${res.status} ${t}`);
    }
    return res.json();
}
//# sourceMappingURL=jiraUserTokenService.js.map