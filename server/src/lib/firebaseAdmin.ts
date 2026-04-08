import admin from 'firebase-admin';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { env } from '../config/env.js';

export function getFirebaseAdmin(): admin.app.App | null {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const json = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!json) {
    return null;
  }
  try {
    const cred = JSON.parse(json) as admin.ServiceAccount;
    return admin.initializeApp({ credential: admin.credential.cert(cred) });
  } catch (e) {
    console.error('Failed to initialize Firebase Admin:', e);
    return null;
  }
}

export async function markStoryJiraSynced(sessionId: string, storyId: string): Promise<boolean> {
  const a = getFirebaseAdmin();
  if (!a) {
    return false;
  }
  const db = getFirestore(a);
  const path = `planning_poker_sessions/${sessionId}/stories/${storyId}`;
  await db.doc(path).update({
    jiraSyncedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}
