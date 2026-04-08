import admin from 'firebase-admin';
export declare function getFirebaseAdmin(): admin.app.App | null;
export declare function markStoryJiraSynced(sessionId: string, storyId: string): Promise<boolean>;
