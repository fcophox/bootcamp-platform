import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptPat, decryptPat } from './crypto';

const ORIGINAL_KEY = process.env.PAT_ENCRYPTION_KEY;
const TEST_KEY = 'a'.repeat(64); // 32 bytes as hex

beforeEach(() => {
    process.env.PAT_ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.PAT_ENCRYPTION_KEY;
    else process.env.PAT_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe('encryptPat / decryptPat', () => {
    it('round-trips a plaintext PAT', () => {
        const encrypted = encryptPat('ghp_exampletoken1234');
        expect(encrypted).not.toContain('ghp_exampletoken1234');
        expect(decryptPat(encrypted)).toBe('ghp_exampletoken1234');
    });

    it('produces a different ciphertext each time (random IV)', () => {
        const a = encryptPat('same-value');
        const b = encryptPat('same-value');
        expect(a).not.toBe(b);
        expect(decryptPat(a)).toBe('same-value');
        expect(decryptPat(b)).toBe('same-value');
    });

    it('throws when the ciphertext has been tampered with', () => {
        const encrypted = encryptPat('ghp_exampletoken1234');
        const [iv, tag, ciphertextB64] = encrypted.split('.');
        const tampered = Buffer.from(ciphertextB64, 'base64');
        tampered[0] = tampered[0] ^ 0xff;
        const tamperedEncoded = `${iv}.${tag}.${tampered.toString('base64')}`;
        expect(() => decryptPat(tamperedEncoded)).toThrow();
    });

    it('throws a clear error when PAT_ENCRYPTION_KEY is missing', () => {
        delete process.env.PAT_ENCRYPTION_KEY;
        expect(() => encryptPat('x')).toThrow('PAT_ENCRYPTION_KEY');
    });

    it('throws a clear error when PAT_ENCRYPTION_KEY is the wrong length', () => {
        process.env.PAT_ENCRYPTION_KEY = 'tooshort';
        expect(() => encryptPat('x')).toThrow('32 bytes');
    });

    it('throws on a malformed encoded string', () => {
        expect(() => decryptPat('not-the-right-shape')).toThrow('inválido');
    });
});
