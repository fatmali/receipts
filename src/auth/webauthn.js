// WebAuthn registration, authentication, and secret management
// Uses platform authenticator (Face ID / Touch ID) for local user verification

import { generateKey, encrypt, decrypt, deriveKeyFromPin } from './crypto.js';

const CREDENTIAL_KEY = 'receipts_credential_id';
const WEBAUTHN_SECRET_KEY = 'receipts_webauthn_encrypted_secret';
const PIN_SECRET_KEY = 'receipts_pin_encrypted_secret';
const APPS_SCRIPT_URL_KEY = 'receipts_apps_script_url';
const SETUP_COMPLETE_KEY = 'receipts_setup_complete';

// Wrapper key lives in memory only — never persisted to localStorage.
// The user must re-authenticate with biometrics each new session.
let _wrapperKey = null;

// ---- base64url helpers ----

export function base64urlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ---- WebAuthn availability ----

export async function isWebAuthnAvailable() {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ---- WebAuthn register ----

export async function register(userId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId || 'user');

  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Receipts' },
      user: {
        id: userIdBytes,
        name: 'Receipts User',
        displayName: 'Receipts User',
      },
      challenge,
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
    },
  });

  const credentialId = base64urlEncode(credential.rawId);
  return { credentialId, publicKey: credential.response };
}

// ---- WebAuthn authenticate ----

export async function authenticate(credentialId) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: base64urlDecode(credentialId),
            type: 'public-key',
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return true;
  } catch {
    return false;
  }
}

// ---- Full setup flow ----

export async function setupAuth(appsScriptUrl, hmacSecret, pin) {
  // 1. Register WebAuthn credential
  const { credentialId } = await register('user');

  // 2. Generate a wrapper key, encrypt HMAC secret with it
  // Wrapper key stays in memory only — never written to localStorage
  const wrapperKey = await generateKey();
  _wrapperKey = wrapperKey;
  const webauthnEncrypted = await encrypt(wrapperKey, hmacSecret);

  localStorage.setItem(WEBAUTHN_SECRET_KEY, JSON.stringify(webauthnEncrypted));

  // 3. Derive PIN key via PBKDF2, encrypt HMAC secret separately
  const pinKey = await deriveKeyFromPin(pin);
  const pinEncrypted = await encrypt(pinKey, hmacSecret);
  localStorage.setItem(PIN_SECRET_KEY, JSON.stringify(pinEncrypted));

  // 4. Store credential ID and Apps Script URL
  localStorage.setItem(CREDENTIAL_KEY, credentialId);
  localStorage.setItem(APPS_SCRIPT_URL_KEY, appsScriptUrl);

  // 5. Mark setup complete
  localStorage.setItem(SETUP_COMPLETE_KEY, 'true');

  return hmacSecret;
}

// ---- Unlock flows ----

export async function unlockWithWebAuthn() {
  const credentialId = localStorage.getItem(CREDENTIAL_KEY);
  if (!credentialId) throw new Error('No credential registered');

  const verified = await authenticate(credentialId);
  if (!verified) throw new Error('WebAuthn authentication failed');

  // Wrapper key is only available in memory during the session it was created.
  // After a fresh app launch, WebAuthn re-auth succeeds but we need to
  // fall back to PIN for decryption since the in-memory key is gone.
  if (!_wrapperKey) {
    throw new Error('Session expired — use PIN to unlock');
  }

  const encrypted = JSON.parse(localStorage.getItem(WEBAUTHN_SECRET_KEY));
  if (!encrypted) throw new Error('No encrypted secret found');

  return decrypt(_wrapperKey, encrypted.ciphertext, encrypted.iv);
}

export async function unlockWithPin(pin) {
  const encrypted = JSON.parse(localStorage.getItem(PIN_SECRET_KEY));
  if (!encrypted) throw new Error('No PIN-encrypted secret found');

  const pinKey = await deriveKeyFromPin(pin);
  try {
    return await decrypt(pinKey, encrypted.ciphertext, encrypted.iv);
  } catch {
    throw new Error('Incorrect PIN');
  }
}
