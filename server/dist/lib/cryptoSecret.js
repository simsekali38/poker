import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
function encryptionKey() {
    const k = Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64');
    if (k.length !== 32) {
        throw new Error('TOKEN_ENCRYPTION_KEY must be base64 encoding of 32 bytes');
    }
    return k;
}
export function encryptString(plain) {
    const key = encryptionKey();
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}
export function decryptString(blob) {
    const key = encryptionKey();
    const buf = Buffer.from(blob, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
//# sourceMappingURL=cryptoSecret.js.map