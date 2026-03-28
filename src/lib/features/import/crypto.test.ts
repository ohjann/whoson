import { describe, it, expect } from 'vitest';
import { generateDeviceKey, encryptKey, decryptKey, generateAuthKey } from './crypto.js';

describe('generateDeviceKey', () => {
	it('returns a CryptoKey', async () => {
		const key = await generateDeviceKey();
		expect(key).toBeInstanceOf(CryptoKey);
		expect(key.algorithm.name).toBe('AES-GCM');
		expect(key.usages).toContain('encrypt');
		expect(key.usages).toContain('decrypt');
	});
});

describe('encryptKey / decryptKey roundtrip', () => {
	it('decrypts back to original plaintext', async () => {
		const key = await generateDeviceKey();
		const plaintext = 'my-super-secret-private-key';
		const ciphertext = await encryptKey(plaintext, key);
		const result = await decryptKey(ciphertext, key);
		expect(result).toBe(plaintext);
	});

	it('produces different ciphertext each call (random IV)', async () => {
		const key = await generateDeviceKey();
		const plaintext = 'same-input';
		const ct1 = await encryptKey(plaintext, key);
		const ct2 = await encryptKey(plaintext, key);
		expect(ct1).not.toBe(ct2);
	});

	it('different device keys produce different ciphertext', async () => {
		const key1 = await generateDeviceKey();
		const key2 = await generateDeviceKey();
		const plaintext = 'test-key';
		const ct1 = await encryptKey(plaintext, key1);
		const ct2 = await encryptKey(plaintext, key2);
		expect(ct1).not.toBe(ct2);
	});

	it('decryption with wrong key fails gracefully', async () => {
		const key1 = await generateDeviceKey();
		const key2 = await generateDeviceKey();
		const ciphertext = await encryptKey('secret', key1);
		await expect(decryptKey(ciphertext, key2)).rejects.toThrow('Decryption failed');
	});

	it('tampered ciphertext fails gracefully', async () => {
		const key = await generateDeviceKey();
		const ciphertext = await encryptKey('secret', key);
		const parsed = JSON.parse(ciphertext);
		// Flip last character of ct
		const ct = parsed.ct;
		parsed.ct = ct.slice(0, -1) + (ct.slice(-1) === 'A' ? 'B' : 'A');
		await expect(decryptKey(JSON.stringify(parsed), key)).rejects.toThrow('Decryption failed');
	});

	it('malformed ciphertext fails gracefully', async () => {
		const key = await generateDeviceKey();
		await expect(decryptKey('not-json', key)).rejects.toThrow('Decryption failed');
	});
});

describe('generateAuthKey', () => {
	it('produces a 64-character hex string (SHA-256)', async () => {
		const hash = await generateAuthKey('user', 'priv', 'param', '9999999999');
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('is deterministic for same inputs', async () => {
		const h1 = await generateAuthKey('user', 'priv', 'param', '9999999999');
		const h2 = await generateAuthKey('user', 'priv', 'param', '9999999999');
		expect(h1).toBe(h2);
	});

	it('differs when any input changes', async () => {
		const base = await generateAuthKey('user', 'priv', 'param', '9999999999');
		const diff1 = await generateAuthKey('other', 'priv', 'param', '9999999999');
		const diff2 = await generateAuthKey('user', 'other', 'param', '9999999999');
		expect(base).not.toBe(diff1);
		expect(base).not.toBe(diff2);
	});
});
