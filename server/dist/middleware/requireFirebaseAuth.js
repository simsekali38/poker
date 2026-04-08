import admin from 'firebase-admin';
import { env } from '../config/env.js';
import { getFirebaseAdmin } from '../lib/firebaseAdmin.js';
export async function requireFirebaseAuth(req, res, next) {
    if (env.DEV_SKIP_AUTH === 'true' && env.DEV_FIREBASE_UID) {
        req.firebaseUid = env.DEV_FIREBASE_UID;
        next();
        return;
    }
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
        res.status(401).json({ error: 'Missing Authorization Bearer token' });
        return;
    }
    const app = getFirebaseAdmin();
    if (!app) {
        res.status(503).json({ error: 'Firebase Admin is not configured on the server' });
        return;
    }
    try {
        const decoded = await admin.auth(app).verifyIdToken(token);
        req.firebaseUid = decoded.uid;
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired Firebase ID token' });
    }
}
//# sourceMappingURL=requireFirebaseAuth.js.map