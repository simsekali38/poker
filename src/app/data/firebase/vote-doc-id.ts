/** Stable vote doc id per voter, story, and round (no `/` in id). */
export function voteDocumentId(
  memberId: string,
  storyId: string,
  roundEpoch: number,
): string {
  return `${memberId}__${storyId}__${roundEpoch}`;
}
