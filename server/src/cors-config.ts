import type { CorsOptions } from 'cors';
import type { RequestHandler } from 'express';
import type { AppEnv } from './config/env.js';

/** Parse `CORS_ORIGIN` into a whitelist, or `all` when `*`. Trailing slashes stripped. */
export function parseCorsOrigins(env: AppEnv): { mode: 'all' } | { mode: 'list'; origins: string[] } {
  const raw = env.CORS_ORIGIN.trim();
  if (raw === '*') {
    return { mode: 'all' };
  }
  const origins = raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return { mode: 'list', origins };
}

/** Logged once at startup so production CORS mistakes are obvious in logs. */
export function formatCorsOriginsForLog(parsed: ReturnType<typeof parseCorsOrigins>): string {
  if (parsed.mode === 'all') {
    return '* (reflect request Origin — use only in dev)';
  }
  return parsed.origins.length > 0 ? parsed.origins.join(', ') : '(empty — falling back to reflect Origin)';
}

/** Whether a browser Origin may receive credentialed CORS responses. */
export function resolveCorsAllowOrigin(
  env: AppEnv,
  requestOrigin: string | undefined,
): { allow: false } | { allow: true; headerValue: string } {
  const parsed = parseCorsOrigins(env);
  if (parsed.mode === 'all') {
    if (requestOrigin) {
      return { allow: true, headerValue: requestOrigin };
    }
    return { allow: false };
  }
  if (parsed.origins.length === 0) {
    if (requestOrigin) {
      return { allow: true, headerValue: requestOrigin };
    }
    return { allow: false };
  }
  if (!requestOrigin) {
    return { allow: false };
  }
  if (parsed.origins.includes(requestOrigin)) {
    return { allow: true, headerValue: requestOrigin };
  }
  return { allow: false };
}

/**
 * Handles OPTIONS preflight first so `Access-Control-*` is always set when the origin is allowed.
 */
export function preflightCorsMiddleware(env: AppEnv): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'OPTIONS') {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }
    const decision = resolveCorsAllowOrigin(env, origin);
    if (!decision.allow) {
      res.status(403).end();
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', decision.headerValue);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    const reqHdr = req.headers['access-control-request-headers'];
    res.setHeader('Access-Control-Allow-Headers', reqHdr || 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
  };
}

export function buildCorsOptions(env: AppEnv): CorsOptions {
  const parsed = parseCorsOrigins(env);
  return {
    origin: (requestOrigin, callback) => {
      if (parsed.mode === 'all') {
        callback(null, requestOrigin ?? true);
        return;
      }
      if (parsed.origins.length === 0) {
        callback(null, requestOrigin ?? true);
        return;
      }
      const decision = resolveCorsAllowOrigin(env, requestOrigin);
      if (decision.allow) {
        callback(null, decision.headerValue);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  };
}
