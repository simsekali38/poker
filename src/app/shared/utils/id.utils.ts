const SESSION_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ENTITY_ID_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function randomFromAlphabet(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length]!;
  }
  return out;
}

/** Short human-friendly session codes (no I/O/0/1 ambiguity). */
export function generateSessionId(): string {
  return randomFromAlphabet(SESSION_ID_ALPHABET, 8);
}

/** Firestore subdocument ids (stories, votes, etc.). */
export function generateEntityId(): string {
  return randomFromAlphabet(ENTITY_ID_ALPHABET, 20);
}
