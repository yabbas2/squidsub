import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { AmazonDrmDecryptor } from '../../../src/services/squidwtf/amazon-drm-decryptor.js';

// In CTR mode, encryption and decryption are the same operation (XOR with keystream)
function encryptCtr(plaintext: Buffer, key: Buffer, iv: Buffer): Buffer {
  const decrypt = new AmazonDrmDecryptor();
  return decrypt.decryptAes128Ctr(plaintext, key, iv);
}

describe('AmazonDrmDecryptor', () => {
  const decryptor = new AmazonDrmDecryptor();
  const key = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);

  it('decrypts successfully', () => {
    const plaintext = Buffer.from('Hello, AES-128 CTR!');
    const encrypted = encryptCtr(plaintext, key, iv);
    const decrypted = decryptor.decryptAes128Ctr(encrypted, key, iv);
    expect(decrypted).toEqual(plaintext);
  });

  it('is its own inverse', () => {
    const data = Buffer.from('Test data for CTR mode decryption');
    const round1 = decryptor.decryptAes128Ctr(data, key, iv);
    const round2 = decryptor.decryptAes128Ctr(round1, key, iv);
    expect(round2).toEqual(data);
  });

  it('handles empty data', () => {
    const result = decryptor.decryptAes128Ctr(Buffer.from([]), key, iv);
    expect(result).toHaveLength(0);
  });

  it('handles non-aligned length', () => {
    const data = Buffer.from('123');
    const encrypted = encryptCtr(data, key, iv);
    const decrypted = decryptor.decryptAes128Ctr(encrypted, key, iv);
    expect(decrypted).toEqual(data);
  });
});
