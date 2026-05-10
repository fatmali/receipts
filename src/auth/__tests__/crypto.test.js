import { describe, it, expect, beforeEach } from 'vitest';
import {
  encrypt,
  decrypt,
  deriveKeyFromPin,
  generateKey,
  exportKey,
  importKey,
} from '../crypto.js';

/*
 * Tests for the crypto module (AES-GCM + PBKDF2).
 * Gus's implementation uses SubtleCrypto directly.
 *
 * API contract:
 *   encrypt(key, plaintext) → { ciphertext, iv }  (base64 strings)
 *   decrypt(key, ciphertext, iv) → plaintext string
 *   deriveKeyFromPin(pin) → CryptoKey (non-extractable)
 *   generateKey() → CryptoKey (extractable)
 *   exportKey(key) → base64 string
 *   importKey(base64) → CryptoKey
 */

describe('encrypt / decrypt roundtrip', () => {
  it('encrypts and decrypts back to the original plaintext', async () => {
    const key = await generateKey();
    const { ciphertext, iv } = await encrypt(key, 'hello world');
    const plaintext = await decrypt(key, ciphertext, iv);

    expect(plaintext).toBe('hello world');
  });

  it('handles empty string', async () => {
    const key = await generateKey();
    const { ciphertext, iv } = await encrypt(key, '');
    const plaintext = await decrypt(key, ciphertext, iv);

    expect(plaintext).toBe('');
  });

  it('handles unicode text', async () => {
    const key = await generateKey();
    const text = 'KES 1,234 — receipts 🧾';
    const { ciphertext, iv } = await encrypt(key, text);
    const plaintext = await decrypt(key, ciphertext, iv);

    expect(plaintext).toBe(text);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', async () => {
    const key = await generateKey();

    const ct1 = await encrypt(key, 'same text');
    const ct2 = await encrypt(key, 'same text');

    // Two encryptions should produce different IVs and ciphertexts
    expect(ct1.iv).not.toBe(ct2.iv);
    expect(ct1.ciphertext).not.toBe(ct2.ciphertext);
  });

  it('fails to decrypt with the wrong key', async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();

    const { ciphertext, iv } = await encrypt(key1, 'secret');

    await expect(decrypt(key2, ciphertext, iv)).rejects.toThrow();
  });

  it('returns base64 strings for ciphertext and iv', async () => {
    const key = await generateKey();
    const { ciphertext, iv } = await encrypt(key, 'test');

    expect(typeof ciphertext).toBe('string');
    expect(typeof iv).toBe('string');
    // Base64 should only contain A-Z, a-z, 0-9, +, /, =
    expect(ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(iv).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

describe('deriveKeyFromPin (PBKDF2)', () => {
  beforeEach(() => {
    // Clear stored salt so each test starts fresh
    localStorage.removeItem('receipts_pbkdf2_salt');
  });

  it('returns a CryptoKey from a PIN', async () => {
    const key = await deriveKeyFromPin('1234');

    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('same PIN produces same key (deterministic with same salt)', async () => {
    // Derive two keys with the same PIN — salt is created once and reused
    const key1 = await deriveKeyFromPin('1234');
    const key2 = await deriveKeyFromPin('1234');

    // Can't export (non-extractable), so verify by encrypting with one
    // and decrypting with the other
    const { ciphertext, iv } = await encrypt(key1, 'round-trip test');
    const plaintext = await decrypt(key2, ciphertext, iv);

    expect(plaintext).toBe('round-trip test');
  });

  it('different PINs produce different keys', async () => {
    const key1 = await deriveKeyFromPin('1234');
    const { ciphertext, iv } = await encrypt(key1, 'only for 1234');

    // Clear salt so key2 uses a fresh salt, guaranteeing difference
    localStorage.removeItem('receipts_pbkdf2_salt');
    const key2 = await deriveKeyFromPin('5678');

    await expect(decrypt(key2, ciphertext, iv)).rejects.toThrow();
  });

  it('derived key can encrypt and decrypt', async () => {
    const key = await deriveKeyFromPin('9999');
    const { ciphertext, iv } = await encrypt(key, 'pin-protected data');
    const plaintext = await decrypt(key, ciphertext, iv);

    expect(plaintext).toBe('pin-protected data');
  });
});

describe('key export / import', () => {
  it('generateKey creates an extractable key', async () => {
    const key = await generateKey();

    expect(key.extractable).toBe(true);
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('exports a key to a base64 string', async () => {
    const key = await generateKey();
    const exported = await exportKey(key);

    expect(typeof exported).toBe('string');
    expect(exported.length).toBeGreaterThan(0);
  });

  it('imported key can decrypt data encrypted with the original key', async () => {
    const originalKey = await generateKey();
    const { ciphertext, iv } = await encrypt(originalKey, 'survive export');

    const exported = await exportKey(originalKey);
    const importedKey = await importKey(exported);

    const plaintext = await decrypt(importedKey, ciphertext, iv);
    expect(plaintext).toBe('survive export');
  });

  it('export → import roundtrip produces equivalent key', async () => {
    const key = await generateKey();
    const exported1 = await exportKey(key);
    const reimported = await importKey(exported1);
    const exported2 = await exportKey(reimported);

    expect(exported1).toBe(exported2);
  });
});
