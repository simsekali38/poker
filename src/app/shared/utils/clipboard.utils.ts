/**
 * Best-effort clipboard write (HTTPS Clipboard API, then `execCommand` fallback).
 * @returns Whether copy likely succeeded.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* try fallback */
  }
  try {
    const doc = globalThis.document;
    if (!doc?.body) {
      return false;
    }
    const ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    doc.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = doc.execCommand('copy');
    doc.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
