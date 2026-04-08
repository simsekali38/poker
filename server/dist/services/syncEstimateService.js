import { env } from '../config/env.js';
import { markStoryJiraSynced } from '../lib/firebaseAdmin.js';
import { getIssueProperty, getIssueWithCloudId, postIssueComment, putBoardEstimation, putIssueProperty, putStoryPointsField, } from './jiraRestService.js';
/** Scrum board Agile API (optional). Details panel “Story Points” uses `JIRA_STORY_POINTS_FIELD_ID` instead. */
function useBoardEstimationApi() {
    return process.env.JIRA_USE_BOARD_ESTIMATION === 'true';
}
function includeAuditIssueProperty() {
    return process.env.JIRA_INCLUDE_AUDIT_PROPERTY === 'true';
}
const AUDIT_KEY = 'planningPokerAudit';
const MAX_AUDIT_ENTRIES = 40;
function mapCardToStoryPoints(estimate) {
    const label = estimate.trim();
    if (/^\d+(\.\d+)?$/.test(label)) {
        return { numeric: Number(label), label };
    }
    const tshirt = {
        xs: 1,
        s: 2,
        m: 3,
        l: 5,
        xl: 8,
    };
    const low = label.toLowerCase();
    if (low in tshirt) {
        return { numeric: tshirt[low], label };
    }
    return { numeric: null, label };
}
function buildCommentText(input) {
    const lines = [
        '[Planning poker]',
        `Session: ${input.sessionId}`,
        `Story: ${input.storyTitle} (${input.storyId})`,
        `Final estimate: ${input.estimate} (${input.method})`,
        `Time: ${new Date().toISOString()}`,
        '',
        'Votes (revealed):',
        ...input.votes.map((v) => `• ${v.displayName}: ${v.card}`),
    ];
    return lines.join('\n');
}
export async function syncEstimateToJira(firebaseUid, input) {
    const { cloudId, issue } = await getIssueWithCloudId(firebaseUid, input.jiraIssueKey, input.jiraSiteUrl);
    const issueId = issue.issueId;
    const { numeric, label } = mapCardToStoryPoints(input.estimate);
    const boardId = input.jiraBoardId?.trim() || env.JIRA_DEFAULT_BOARD_ID?.trim();
    // Primary: Issue → Details “Story Points” field (REST `fields[customfield_…]` = number).
    if (numeric !== null) {
        await putStoryPointsField(firebaseUid, cloudId, issueId, numeric);
        if (useBoardEstimationApi() && boardId) {
            try {
                await putBoardEstimation(firebaseUid, cloudId, issueId, boardId, String(numeric));
            }
            catch (e) {
                console.warn('Optional board estimation failed (Story Points field was already set):', e);
            }
        }
    }
    if (includeAuditIssueProperty()) {
        const raw = await getIssueProperty(firebaseUid, cloudId, issueId, AUDIT_KEY);
        const prev = raw && typeof raw === 'object' && raw !== null && 'value' in raw
            ? raw.value
            : raw;
        let entries = [];
        if (prev && typeof prev === 'object' && prev !== null && 'entries' in prev) {
            const e = prev.entries;
            if (Array.isArray(e)) {
                entries = [...e];
            }
        }
        const entry = {
            sessionId: input.sessionId,
            storyId: input.storyId,
            storyTitle: input.storyTitle,
            timestamp: new Date().toISOString(),
            votes: input.votes,
            participants: input.participants,
            finalEstimate: { card: input.estimate, label, method: input.method, numeric },
        };
        entries.push(entry);
        if (entries.length > MAX_AUDIT_ENTRIES) {
            entries = entries.slice(-MAX_AUDIT_ENTRIES);
        }
        await putIssueProperty(firebaseUid, cloudId, issueId, AUDIT_KEY, {
            version: 1,
            entries,
        });
    }
    if (input.includeComment === true) {
        await postIssueComment(firebaseUid, cloudId, issueId, buildCommentText(input));
    }
    const fs = await markStoryJiraSynced(input.sessionId, input.storyId);
    return { firestoreUpdated: fs };
}
//# sourceMappingURL=syncEstimateService.js.map