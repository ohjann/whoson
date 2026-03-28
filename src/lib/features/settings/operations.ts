import { db } from '$lib/db';
import type { AppSettings } from '$lib/types';
import { encryptKey, decryptKey, generateDeviceKey } from '$lib/features/import/crypto';

const DEVICE_KEY_STORAGE = 'whoson_device_key';

/**
 * Get or create the device key used to encrypt credentials.
 * The key is persisted in localStorage as an exported JWK.
 */
async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (stored) {
    try {
      const jwk = JSON.parse(stored) as JsonWebKey;
      return await crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt'
      ]);
    } catch {
      // Invalid key; generate a new one
    }
  }
  const key = await generateDeviceKey();
  const jwk = await crypto.subtle.exportKey('jwk', key);
  localStorage.setItem(DEVICE_KEY_STORAGE, JSON.stringify(jwk));
  return key;
}

export async function getSettings(): Promise<AppSettings | undefined> {
  return db.settings.toCollection().first();
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
  const settings = await db.settings.toCollection().first();
  if (settings?.id != null) {
    await db.settings.update(settings.id, patch);
  } else {
    await db.settings.add({ notificationsEnabled: false, ...patch });
  }
}

/**
 * Store Clashfinder credentials. If rememberKey is true, the private key
 * is encrypted with a device key and stored in AppSettings. If false,
 * only the username is stored and the private key is returned for session use only.
 */
export async function saveClashfinderCredentials(
  username: string,
  privateKey: string,
  rememberKey: boolean
): Promise<void> {
  if (rememberKey && privateKey) {
    const deviceKey = await getOrCreateDeviceKey();
    const encrypted = await encryptKey(privateKey, deviceKey);
    await updateSettings({ clashfinderUsername: username, encryptedPrivateKey: encrypted });
  } else {
    await updateSettings({ clashfinderUsername: username, encryptedPrivateKey: undefined });
  }
}

/**
 * Decrypt and return the stored private key, or null if not stored.
 */
export async function getDecryptedPrivateKey(): Promise<string | null> {
  const settings = await getSettings();
  if (!settings?.encryptedPrivateKey) return null;
  try {
    const stored = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (!stored) return null;
    const jwk = JSON.parse(stored) as JsonWebKey;
    const deviceKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    return await decryptKey(settings.encryptedPrivateKey, deviceKey);
  } catch {
    return null;
  }
}

/**
 * Clear all app data (festivals, acts, highlights, settings, maps).
 */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.festivals, db.acts, db.highlights, db.settings, db.festivalMaps],
    async () => {
      await db.festivals.clear();
      await db.acts.clear();
      await db.highlights.clear();
      await db.settings.clear();
      await db.festivalMaps.clear();
    }
  );
  localStorage.removeItem(DEVICE_KEY_STORAGE);
}
