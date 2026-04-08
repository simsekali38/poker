import { env } from '../config/env.js';
import { getValidAccessToken } from './jiraUserTokenService.js';
import { fetchAccessibleResources, resolveCloudId } from './jiraSiteService.js';
function adfToPlainText(node) {
    if (!node || typeof node !== 'object') {
        return '';
    }
    const n = node;
    if (n['type'] === 'doc' && Array.isArray(n['content'])) {
        return n['content'].map(adfToPlainText).join('\n');
    }
    if (n['type'] === 'paragraph' && Array.isArray(n['content'])) {
        return n['content'].map(adfToPlainText).join('');
    }
    if (n['type'] === 'text' && typeof n['text'] === 'string') {
        return n['text'];
    }
    if (Array.isArray(n['content'])) {
        return n['content'].map(adfToPlainText).join('');
    }
    return '';
}
export async function getIssueWithCloudId(firebaseUid, issueKey, siteUrl) {
    const access = await getValidAccessToken(firebaseUid);
    const resources = await fetchAccessibleResources(access);
    const cloudId = resolveCloudId(resources, siteUrl);
    const issue = await fetchIssueByCloudId(access, cloudId, issueKey);
    return { cloudId, issue };
}
export async function getIssueForUser(firebaseUid, issueKey, siteUrl) {
    const { issue } = await getIssueWithCloudId(firebaseUid, issueKey, siteUrl);
    return issue;
}
async function fetchIssueByCloudId(accessToken, cloudId, issueKey) {
    const fields = 'summary,description,status,assignee';
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=${fields}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Jira issue fetch failed: ${res.status} ${t}`);
    }
    const data = (await res.json());
    const desc = data.fields.description;
    let plain = null;
    if (desc == null) {
        plain = null;
    }
    else if (typeof desc === 'object' && desc['type'] === 'doc') {
        plain = adfToPlainText(desc) || null;
    }
    else if (typeof desc === 'string') {
        plain = desc;
    }
    else {
        plain = JSON.stringify(desc);
    }
    return {
        issueKey: data.key,
        issueId: data.id,
        summary: data.fields.summary ?? '',
        description: plain || null,
        status: {
            id: data.fields.status.id,
            name: data.fields.status.name,
            category: data.fields.status.statusCategory?.name,
        },
        assignee: data.fields.assignee
            ? {
                accountId: data.fields.assignee.accountId,
                displayName: data.fields.assignee.displayName ?? data.fields.assignee.accountId,
                emailAddress: data.fields.assignee.emailAddress ?? null,
            }
            : null,
    };
}
export async function getCloudIdForUser(firebaseUid, siteUrl) {
    const access = await getValidAccessToken(firebaseUid);
    const resources = await fetchAccessibleResources(access);
    return resolveCloudId(resources, siteUrl);
}
/** PUT agile estimation when boardId is known */
export async function putBoardEstimation(firebaseUid, cloudId, issueId, boardId, valueStr) {
    const access = await getValidAccessToken(firebaseUid);
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/agile/1.0/issue/${issueId}/estimation?boardId=${encodeURIComponent(boardId)}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${access}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: valueStr }),
    });
    if (!res.ok && res.status !== 204) {
        const t = await res.text();
        throw new Error(`Board estimation failed: ${res.status} ${t}`);
    }
}
/** Fallback: story points custom field */
export async function putStoryPointsField(firebaseUid, cloudId, issueId, points) {
    const access = await getValidAccessToken(firebaseUid);
    const fieldId = env.JIRA_STORY_POINTS_FIELD_ID;
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueId}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${access}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fields: {
                [fieldId]: points,
            },
        }),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Story points update failed: ${res.status} ${t}`);
    }
}
export async function getIssueProperty(firebaseUid, cloudId, issueId, propertyKey) {
    const access = await getValidAccessToken(firebaseUid);
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueId}/properties/${encodeURIComponent(propertyKey)}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${access}`, Accept: 'application/json' },
    });
    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`get property failed: ${res.status} ${t}`);
    }
    return res.json();
}
export async function putIssueProperty(firebaseUid, cloudId, issueId, propertyKey, value) {
    const access = await getValidAccessToken(firebaseUid);
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueId}/properties/${encodeURIComponent(propertyKey)}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${access}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(value),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`put property failed: ${res.status} ${t}`);
    }
}
function buildAdfParagraph(text) {
    return {
        type: 'doc',
        version: 1,
        content: [
            {
                type: 'paragraph',
                content: [{ type: 'text', text }],
            },
        ],
    };
}
export async function postIssueComment(firebaseUid, cloudId, issueId, plainText) {
    const access = await getValidAccessToken(firebaseUid);
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${issueId}/comment`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${access}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: buildAdfParagraph(plainText) }),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`comment failed: ${res.status} ${t}`);
    }
}
//# sourceMappingURL=jiraRestService.js.map