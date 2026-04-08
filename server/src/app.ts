import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import {
  buildCorsOptions,
  parseCorsOrigins,
  preflightCorsMiddleware,
  resolveCorsAllowOrigin,
} from './cors-config.js';
import { env } from './config/env.js';
import { jiraOAuthRouter } from './routes/jiraOAuthRoutes.js';
import { jiraIssueRouter } from './routes/jiraIssueRoutes.js';
import { jiraSyncRouter } from './routes/jiraSyncRoutes.js';

const corsOptions = buildCorsOptions(env);

export function createApp(): express.Express {
  const app = express();

  app.use(preflightCorsMiddleware(env));
  app.use(cors(corsOptions));

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );

  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'poker-planning-server' });
  });

  /** Debug: GET with header `Origin: https://poker.example.com` — shows if that origin is allowed. */
  app.get('/api/cors-check', (req, res) => {
    const origin = req.headers.origin;
    const parsed = parseCorsOrigins(env);
    const decision = origin ? resolveCorsAllowOrigin(env, origin) : { allow: false as const };
    res.json({
      ok: true,
      requestOrigin: origin ?? null,
      allowed: decision.allow,
      configuredOrigins: parsed.mode === 'list' ? parsed.origins : ['*'],
    });
  });

  app.use('/api/jira', jiraOAuthRouter);
  app.use('/api/jira', jiraIssueRouter);
  app.use('/api/jira', jiraSyncRouter);

  const staticRoot = env.STATIC_ROOT?.trim();
  if (staticRoot) {
    const absolute = path.isAbsolute(staticRoot) ? staticRoot : path.resolve(process.cwd(), staticRoot);
    app.use(express.static(absolute));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(absolute, 'index.html'), (err) => next(err));
    });
  }

  return app;
}
