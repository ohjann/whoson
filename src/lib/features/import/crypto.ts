/**
 * Credential encryption using Web Crypto API (AES-GCM).
 * Used to optionally store Clashfinder private keys encrypted with a device-specific key.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

export async function generateAuthKey(
	username: string,
	privateKey: string,
	authParam: string,
	authValidUntil: string
): Promise<string> {
	const message = username + privateKey + authParam + authValidUntil;
	const encoder = new TextEncoder();
	const data = encoder.encode(message);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function generateDeviceKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey(
		{ name: ALGORITHM, length: KEY_LENGTH },
		true,
		['encrypt', 'decrypt']
	);
}

export async function encryptKey(plaintext: string, deviceKey: CryptoKey): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoder = new TextEncoder();
	const data = encoder.encode(plaintext);

	const cipherBuffer = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, deviceKey, data);

	// Encode iv + ciphertext as base64 JSON
	const combined = {
		iv: btoa(String.fromCharCode(...iv)),
		ct: btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)))
	};
	return JSON.stringify(combined);
}

export async function decryptKey(ciphertext: string, deviceKey: CryptoKey): Promise<string> {
	let parsed: { iv: string; ct: string };
	try {
		parsed = JSON.parse(ciphertext);
	} catch {
		throw new Error('Decryption failed: invalid ciphertext format');
	}

	let iv: Uint8Array<ArrayBuffer>;
	let ct: Uint8Array<ArrayBuffer>;
	try {
		const ivDecoded = atob(parsed.iv);
		const ctDecoded = atob(parsed.ct);
		iv = new Uint8Array(ivDecoded.length);
		for (let i = 0; i < ivDecoded.length; i++) iv[i] = ivDecoded.charCodeAt(i);
		ct = new Uint8Array(ctDecoded.length);
		for (let i = 0; i < ctDecoded.length; i++) ct[i] = ctDecoded.charCodeAt(i);
	} catch {
		throw new Error('Decryption failed: invalid ciphertext encoding');
	}

	let plainBuffer: ArrayBuffer;
	try {
		plainBuffer = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, deviceKey, ct);
	} catch {
		throw new Error('Decryption failed: tampered or incorrect key');
	}

	return new TextDecoder().decode(plainBuffer);
}
