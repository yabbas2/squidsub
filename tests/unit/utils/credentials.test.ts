import { describe, it, expect } from 'vitest';
import { tryFromDictionary, decryptPassword } from '../../../src/utils/credentials.js';

describe('SubsonicCredentials', () => {
  it('tryFromDictionary returns credentials with valid parameters', () => {
    const result = tryFromDictionary({ u: 'testuser', p: 'testpass', v: '1.16.1', c: 'TestApp' });
    expect(result).not.toBeNull();
    expect(result!.username).toBe('testuser');
    expect(result!.password).toBe('testpass');
    expect(result!.version).toBe('1.16.1');
    expect(result!.client).toBe('TestApp');
  });

  it('tryFromDictionary returns null without username', () => {
    expect(tryFromDictionary({ p: 'pass' })).toBeNull();
  });

  it('tryFromDictionary supports token auth', () => {
    const result = tryFromDictionary({ u: 'user', t: 'token123', s: 'saltsalt' });
    expect(result).not.toBeNull();
    expect(result!.token).toBe('token123');
    expect(result!.salt).toBe('saltsalt');
  });

  it('tryFromDictionary decrypts enc: password', () => {
    // "test" XOR with "gesundheit" repeated
    // t=0x74 ^ 'g'=0x67 = 0x13
    // e=0x65 ^ 'e'=0x65 = 0x00
    // s=0x73 ^ 's'=0x73 = 0x00
    // t=0x74 ^ 'u'=0x75 = 0x01
    const result = tryFromDictionary({ u: 'user', p: 'enc:13000001' });
    expect(result).not.toBeNull();
    expect(result!.password).toBe('test');
  });

  it('tryFromDictionary uses defaults', () => {
    const result = tryFromDictionary({ u: 'user', p: 'pass' });
    expect(result).not.toBeNull();
    expect(result!.version).toBe('1.16.1');
    expect(result!.client).toBe('unknown');
  });

  it('tryFromDictionary returns null without password or token', () => {
    const result = tryFromDictionary({ u: 'user' });
    expect(result).toBeNull();
  });

  it('decryptPassword handles enc: prefix', () => {
    const decrypted = decryptPassword('enc:13000001');
    expect(decrypted).toBe('test');
  });
});
