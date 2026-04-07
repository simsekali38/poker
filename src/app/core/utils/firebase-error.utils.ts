/** Firebase JS SDK / Firestore client error shape (subset). */
export function getFirebaseErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object' || !('code' in err)) {
    return null;
  }
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export function isFirebasePermissionDenied(err: unknown): boolean {
  return getFirebaseErrorCode(err) === 'permission-denied';
}
