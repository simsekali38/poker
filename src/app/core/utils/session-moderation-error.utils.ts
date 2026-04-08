import type { SessionModerationFailure } from '@app/core/services/session-moderation.service';

const MODERATION_CODES: ReadonlySet<string> = new Set<SessionModerationFailure>([
  'SESSION_NOT_FOUND',
  'NOT_MODERATOR',
  'NO_ACTIVE_STORY',
  'SESSION_NOT_ACTIVE',
  'STORY_NOT_FOUND',
  'INVALID_STORY_TITLE',
  'ROUND_NOT_REVEALED',
  'INVALID_JIRA_ISSUE_KEY',
  'INVALID_JIRA_SITE',
  'INVALID_JIRA_BOARD_ID',
]);

export type SessionModerationError = Error & { moderationCode: SessionModerationFailure };

export function isSessionModerationError(err: unknown): err is SessionModerationError {
  if (!err || typeof err !== 'object' || !('moderationCode' in err)) {
    return false;
  }
  const code = (err as { moderationCode?: unknown }).moderationCode;
  return typeof code === 'string' && MODERATION_CODES.has(code);
}
