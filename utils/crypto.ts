import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

function getKey(): Buffer {
    const hex = process.env.PAT_ENCRYPTION_KEY;
    if (!hex) {
        throw new Error('PAT_ENCRYPTION_KEY no está configurada');
    }
    const key = Buffer.from(hex, 'hex');
    if (key.length !== KEY_LENGTH_BYTES) {
        throw new Error(
            `PAT_ENCRYPTION_KEY debe representar ${KEY_LENGTH_BYTES} bytes (${KEY_LENGTH_BYTES * 2} caracteres hex)`
        );
    }
    return key;
}

export function encryptPat(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptPat(encoded: string): string {
    const key = getKey();
    const parts = encoded.split('.');
    if (parts.length !== 3) {
        throw new Error('Formato de PAT cifrado inválido');
    }
    const [ivB64, tagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
}
