import { Router } from 'express';
import { requireFirebaseAuth } from '../middleware/requireFirebaseAuth.js';
import { getIssueForUser } from '../services/jiraRestService.js';
const router = Router();
/**
 * GET /jira/issues/:issueKey?siteUrl=https%3A%2F%2F...
 */
router.get('/issues/:issueKey', requireFirebaseAuth, async (req, res) => {
    const issueKey = req.params.issueKey?.trim();
    const siteUrl = typeof req.query.siteUrl === 'string' ? req.query.siteUrl.trim() : '';
    if (!issueKey || !siteUrl) {
        res.status(400).json({ error: 'issueKey and siteUrl query are required' });
        return;
    }
    const uid = req.firebaseUid;
    try {
        const issue = await getIssueForUser(uid, issueKey, siteUrl);
        res.json(issue);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Issue fetch failed';
        res.status(502).json({ error: msg });
    }
});
export { router as jiraIssueRouter };
//# sourceMappingURL=jiraIssueRoutes.js.map