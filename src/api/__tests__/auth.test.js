import { describe, it, expect } from 'vitest';
import { hmacSign } from '../auth.js';

/*
 * Tests for HMAC signing (SubtleCrypto-based).
 *
 * API contract:
 *   hmacSign(secret, message) → hex signature string
 *
 * The implementation uses HMAC-SHA256 via SubtleCrypto.
 * Tests are written against the contract so they'll hold
 * once Gus replaces the stub with the real implementation.
 */

describe('hmacSign', () => {
  it('signs a timestamp string and returns a hex string', async () => {
    const sig = await hmacSign('my-secret', '1715000000000');

    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
  });

  it('is deterministic — same input produces same signature', async () => {
    const sig1 = await hmacSign('secret', '12345');
    const sig2 = await hmacSign('secret', '12345');

    expect(sig1).toBe(sig2);
  });

  it('different messages produce different signatures', async () => {
    const sig1 = await hmacSign('secret', 'message-a');
    const sig2 = await hmacSign('secret', 'message-b');

    expect(sig1).not.toBe(sig2);
  });

  it('different secrets produce different signatures', async () => {
    const sig1 = await hmacSign('secret-1', 'same-message');
    const sig2 = await hmacSign('secret-2', 'same-message');

    expect(sig1).not.toBe(sig2);
  });

  it('output is a valid lowercase hex string', async () => {
    const sig = await hmacSign('key', 'data');

    expect(sig).toMatch(/^[0-9a-f]+$/);
  });

  it('handles empty message string', async () => {
    const sig = await hmacSign('key', '');

    expect(typeof sig).toBe('string');
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });

  it('handles unicode in secret', async () => {
    const sig = await hmacSign('sécret-🔑', 'msg');

    expect(typeof sig).toBe('string');
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });
});
