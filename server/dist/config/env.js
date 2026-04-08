import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
loadEnv();
const schema = z.object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().default(4000),
    CORS_ORIGIN: z.string().default('*'),
    /** If set, Express serves the Angular `browser` build and SPA fallback (single-process deploy). */
    STATIC_ROOT: z.string().optional(),
    DATABASE_URL: z.string().min(1),
    ATLASSIAN_CLIENT_ID: z.string().min(1),
    ATLASSIAN_CLIENT_SECRET: z.string().min(1),
    ATLASSIAN_OAUTH_REDIRECT_URI: z.string().url(),
    ATLASSIAN_SCOPES: z.string().default('read:jira-work write:jira-work offline_access read:me'),
    TOKEN_ENCRYPTION_KEY: z.string().min(1),
    JIRA_STORY_POINTS_FIELD_ID: z.string().default('customfield_10016'),
    JIRA_DEFAULT_BOARD_ID: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
    DEV_SKIP_AUTH: z.enum(['true', 'false']).optional(),
    DEV_FIREBASE_UID: z.string().optional(),
});
function load() {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
        console.error('Invalid environment:', parsed.error.flatten());
        throw new Error('Missing or invalid environment variables. Copy server/.env.example to server/.env');
    }
    return parsed.data;
}
export const env = load();
//# sourceMappingURL=env.js.map