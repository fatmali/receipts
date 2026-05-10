import { describe, it, expect, beforeEach } from 'vitest';
import { get, set, remove } from '../storage.js';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('roundtrips a string value', () => {
    set('key1', 'hello');
    expect(get('key1')).toBe('hello');
  });

  it('roundtrips an object value', () => {
    const obj = { name: 'test', amount: 500 };
    set('key2', obj);
    expect(get('key2')).toEqual(obj);
  });

  it('roundtrips an array value', () => {
    const arr = [1, 2, 3, 'four'];
    set('key3', arr);
    expect(get('key3')).toEqual(arr);
  });

  it('returns null for a non-existent key', () => {
    expect(get('no-such-key')).toBeNull();
  });

  it('returns null after removing a key', () => {
    set('key4', 'value');
    remove('key4');
    expect(get('key4')).toBeNull();
  });

  it('overwrites existing values', () => {
    set('key5', 'first');
    set('key5', 'second');
    expect(get('key5')).toBe('second');
  });

  it('handles booleans and numbers', () => {
    set('bool', true);
    set('num', 42);
    expect(get('bool')).toBe(true);
    expect(get('num')).toBe(42);
  });
});
