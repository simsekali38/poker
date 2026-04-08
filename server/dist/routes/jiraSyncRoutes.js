import { Router } from 'express';
import { z } from 'zod';
import { requireFirebaseAuth } from '../middleware/requireFirebaseAuth.js';
import { syncEstimateToJira } from '../services/syncEstimateService.js';
const router = Router();
const syncBody = z.object({
    sessionId: z.string().min(1),
    storyId: z.string().min(1),
    storyTitle: z.string(),
    jiraIssueKey: z.string().min(1),
    jiraSiteUrl: z.string().url().nullable(),
    jiraBoardId: z.string().nullable().optional(),
    estimate: z.string().min(1),
    method: z.string().min(1),
    includeComment: z.boolean().optional(),
    votes: z.array(z.object({
        memberId: z.string(),
        displayName: z.string(),
        card: z.string(),
    })),
    participants: z.array(z.object({
        memberId: z.string(),
        displayName: z.string(),
    })),
});
/**
 * POST /jira/sync-estimate
 */
router.post('/sync-estimate', requireFirebaseAuth, async (req, res) => {
    const parsed = syncBody.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
        return;
    }
    const uid = req.firebaseUid;
    const b = parsed.data;
    if (!b.jiraSiteUrl) {
        res.status(400).json({ error: 'jiraSiteUrl is required' });
        return;
    }
    try {
        const result = await syncEstimateToJira(uid, {
            sessionId: b.sessionId,
            storyId: b.storyId,
            storyTitle: b.storyTitle,
            jiraIssueKey: b.jiraIssueKey,
            jiraSiteUrl: b.jiraSiteUrl,
            jiraBoardId: b.jiraBoardId,
            estimate: b.estimate,
            method: b.method,
            includeComment: b.includeComment,
            votes: b.votes,
            participants: b.participants,
        });
        res.json({ ok: true, firestoreUpdated: result.firestoreUpdated });
    }
    catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : 'Sync failed';
        res.status(502).json({ error: msg });
    }
});
export { router as jiraSyncRouter };
//# sourceMappingURL=jiraSyncRoutes.js.map