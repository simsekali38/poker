import { DeckPresetId, VoteCard } from '@app/core/models';

export interface DeckPresetOption {
  readonly id: DeckPresetId;
  readonly label: string;
}

export const DECK_PRESET_OPTIONS: readonly DeckPresetOption[] = [
  {
    id: 'classic',
    label: 'Classic (1, 2, 3, 5, 8, 13, 21 + ?, abstain, coffee)',
  },
  { id: 'fibonacci', label: 'Fibonacci (0–13 + specials)' },
  { id: 'modifiedFibonacci', label: 'Modified Fibonacci' },
  { id: 'powersOfTwo', label: 'Powers of two' },
  { id: 'sequential', label: 'Sequential (1–10)' },
  { id: 'tshirt', label: 'T-shirt sizes' },
] as const;

const PRESETS: Record<string, readonly VoteCard[]> = {
  classic: ['1', '2', '3', '5', '8', '13', '21', '?', 'abstain', 'coffee'],
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '?'],
  modifiedFibonacci: ['0', '1', '2', '3', '5', '8', '13', '20', '40', '?', 'coffee', 'abstain'],
  powersOfTwo: ['1', '2', '4', '8', '16', '32', '?', 'coffee', 'abstain'],
  sequential: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '?', 'coffee', 'abstain'],
  tshirt: ['xs', 's', 'm', 'l', 'xl', '?', 'coffee', 'abstain'],
};

export function cardsForDeckPreset(presetId: DeckPresetId): readonly VoteCard[] {
  const cards = PRESETS[presetId];
  return cards ?? PRESETS['classic']!;
}

export function isKnownDeckPresetId(id: string): id is DeckPresetId {
  return id in PRESETS;
}
