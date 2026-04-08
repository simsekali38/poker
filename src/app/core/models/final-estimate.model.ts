import { VoteCard } from './vote-card.model';

/** How the moderator chose the value sent to Jira / recorded as final. */
export type FinalEstimateMethod = 'consensus' | 'rounded_average' | 'moderator_pick';
