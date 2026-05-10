import { describe, it, expect, beforeEach } from 'vitest';
import { getSecret, setSecret, clearSecret, isLocked } from '../session.js';

describe('session', () => {
  beforeEach(() => {
    clearSecret();
  });

  it('returns null when no secret is set', () => {
    expect(getSecret()).toBeNull();
  });

  it('returns the secret after setSecret()', () => {
    setSecret('test-secret');
    expect(getSecret()).toBe('test-secret');
  });

  it('returns null after clearSecret()', () => {
    setSecret('temp');
    clearSecret();
    expect(getSecret()).toBeNull();
  });

  it('isLocked() returns true when no secret is set', () => {
    expect(isLocked()).toBe(true);
  });

  it('isLocked() returns false after setSecret()', () => {
    setSecret('unlock-me');
    expect(isLocked()).toBe(false);
  });

  it('isLocked() returns true after clearSecret()', () => {
    setSecret('temp');
    clearSecret();
    expect(isLocked()).toBe(true);
  });

  it('overwrites previous secret with a new one', () => {
    setSecret('first');
    setSecret('second');
    expect(getSecret()).toBe('second');
  });
});
