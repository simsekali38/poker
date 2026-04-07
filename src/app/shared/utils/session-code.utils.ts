/** Formats an 8-char session code as `XXXX-XXXX` for display and sharing. */
export function formatSessionCodeForDisplay(sessionId: string): string {
  const id = sessionId.trim().toUpperCase();
  if (id.length === 8) {
    return `${id.slice(0, 4)}-${id.slice(4)}`;
  }
  return id;
}
