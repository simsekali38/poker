import { InjectionToken } from '@angular/core';
import { SessionMemberRepository } from '@app/data/repositories/session-member.repository';
import { SessionRepository } from '@app/data/repositories/session.repository';
import { StoryRepository } from '@app/data/repositories/story.repository';
import { VoteRepository } from '@app/data/repositories/vote.repository';

export const SESSION_REPOSITORY = new InjectionToken<SessionRepository>('SESSION_REPOSITORY');

export const SESSION_MEMBER_REPOSITORY = new InjectionToken<SessionMemberRepository>(
  'SESSION_MEMBER_REPOSITORY',
);

export const STORY_REPOSITORY = new InjectionToken<StoryRepository>('STORY_REPOSITORY');

export const VOTE_REPOSITORY = new InjectionToken<VoteRepository>('VOTE_REPOSITORY');
