import type { CorsOptions } from 'cors';
import type { RequestHandler } from 'express';
import type { AppEnv } from './config/env.js';
/** Parse `CORS_ORIGIN` into a whitelist, or `all` when `*`. Trailing slashes stripped. */
export declare function parseCorsOrigins(env: AppEnv): {
    mode: 'all';
} | {
    mode: 'list';
    origins: string[];
};
/** Logged once at startup so production CORS mistakes are obvious in logs. */
export declare function formatCorsOriginsForLog(parsed: ReturnType<typeof parseCorsOrigins>): string;
/** Whether a browser Origin may receive credentialed CORS responses. */
export declare function resolveCorsAllowOrigin(env: AppEnv, requestOrigin: string | undefined): {
    allow: false;
} | {
    allow: true;
    headerValue: string;
};
/**
 * Handles OPTIONS preflight first so `Access-Control-*` is always set when the origin is allowed.
 */
export declare function preflightCorsMiddleware(env: AppEnv): RequestHandler;
export declare function buildCorsOptions(env: AppEnv): CorsOptions;
