// HMAC-SHA256 request signing via SubtleCrypto

let _cachedKey = null;
let _cachedKeySecret = null;

/**
 * Sign a timestamp string with HMAC-SHA256 using the provided secret.
 * @param {string} secret - The HMAC secret (plaintext)
 * @param {string} message - The message to sign (typically Date.now() as string)
 * @returns {Promise<string>} - Hex-encoded HMAC signature
 */
export async function hmacSign(secret, message) {
  const key = await getHmacKey(secret);
  const encoded = new TextEncoder().encode(message);
  const sig = await crypto.subtle.sign('HMAC', key, encoded);
  return bufToHex(new Uint8Array(sig));
}

async function getHmacKey(secret) {
  if (_cachedKey && _cachedKeySecret === secret) return _cachedKey;

  const encoded = new TextEncoder().encode(secret);
  _cachedKey = await crypto.subtle.importKey(
    'raw',
    encoded,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  _cachedKeySecret = secret;
  return _cachedKey;
}

function bufToHex(buf) {
  let hex = '';
  for (let i = 0; i < buf.length; i++) {
    hex += buf[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Clear the cached key (e.g. on lock/logout) */
export function clearKeyCache() {
  _cachedKey = null;
  _cachedKeySecret = null;
}
