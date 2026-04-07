/**
 * Canonical card values (Firestore-friendly strings).
 */
export type VoteCard =
  | `${number}`
  | '?'
  | 'coffee'
  | 'abstain'
  | 'xs'
  | 's'
  | 'm'
  | 'l'
  | 'xl';

export type DeckPresetId =
  | 'classic'
  | 'fibonacci'
  | 'modifiedFibonacci'
  | 'tshirt'
  | 'powersOfTwo'
  | 'sequential'
  | string;
