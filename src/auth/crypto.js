// AES-GCM encryption/decryption + PBKDF2 key derivation
// All operations use SubtleCrypto — no external libraries

const PBKDF2_ITERATIONS = 600_000;
const SALT_KEY = 'receipts_pbkdf2_salt';

/**
 * Generate a random AES-GCM 256-bit key.
 */
export async function generateKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext with an AES-GCM key.
 * Returns { ciphertext, iv } as base64 strings.
 */
export async function encrypt(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return {
    ciphertext: bufToBase64(cipherBuf),
    iv: bufToBase64(iv),
  };
}

/**
 * Decrypt ciphertext+iv with an AES-GCM key. Returns plaintext string.
 */
export async function decrypt(key, ciphertext, iv) {
  const cipherBuf = base64ToBuf(ciphertext);
  const ivBuf = base64ToBuf(iv);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuf },
    key,
    cipherBuf
  );
  return new TextDecoder().decode(plainBuf);
}

/**
 * Derive an AES-GCM key from a PIN string using PBKDF2.
 * Uses a stored salt (generated on first use, saved to localStorage).
 * 100,000 iterations, SHA-256.
 */
export async function deriveKeyFromPin(pin) {
  const salt = getOrCreateSalt();
  const pinKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    pinKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to base64 for storage.
 */
export async function exportKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufToBase64(raw);
}

/**
 * Import a base64 string back to a CryptoKey.
 */
export async function importKey(base64Key) {
  const raw = base64ToBuf(base64Key);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// --- internal helpers ---

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getOrCreateSalt() {
  let saltB64 = localStorage.getItem(SALT_KEY);
  if (!saltB64) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    saltB64 = bufToBase64(salt);
    localStorage.setItem(SALT_KEY, saltB64);
  }
  return base64ToBuf(saltB64);
}
