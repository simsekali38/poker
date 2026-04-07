import { DeckPresetId } from '@app/core/models';

export interface SessionCreateFormValue {
  sessionTitle: string;
  moderatorDisplayName: string;
  initialStoryTitle: string;
  deckPresetId: DeckPresetId;
}
