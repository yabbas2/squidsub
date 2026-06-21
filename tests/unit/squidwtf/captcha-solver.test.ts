import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { CaptchaSolver } from '../../../src/services/captcha/captcha-solver.js';

describe('CaptchaSolver (solvePow only, no network)', () => {
  const solver = new CaptchaSolver();

  it('solvePow returns expected format for verification mode', () => {
    const result = solver.solvePow({
      algorithm: 'PBKDF2-HMAC-SHA256',
      nonce: Buffer.from('test').toString('hex'),
      salt: Buffer.from('salt').toString('hex'),
      cost: 1,
      keyLength: 16,
      keyPrefix: 'ffffffffffffffff',
    });
    expect(result.counter).toBe(0);
    expect(result.derivedKey).toBeTruthy();
    expect(typeof result.time).toBe('number');
  });

  it('solvePow for difficulty 1 finds solution quickly', () => {
    const result = solver.solvePow({
      algorithm: 'SHA-256',
      nonce: Buffer.from('testnonce').toString('hex'),
      salt: Buffer.from('testsalt').toString('hex'),
      cost: 1,
      keyLength: 32,
      keyPrefix: '0',
    });
    expect(typeof result.counter).toBe('number');
    expect(result.derivedKey).toMatch(/^0/);
  });

  it('solvePow result produces valid hash for difficulty 3', () => {
    const salt = 'verifysalt';
    const parameters = {
      algorithm: 'SHA-256',
      nonce: Buffer.from('nonce123').toString('hex'),
      salt: Buffer.from(salt).toString('hex'),
      cost: 1,
      keyLength: 32,
      keyPrefix: '000',
    };

    const solution = solver.solvePow(parameters);
    const hash = crypto
      .createHash('sha256')
      .update(Buffer.concat([
        Buffer.from(salt),
        Buffer.from('nonce123'),
        (() => { const b = Buffer.alloc(4); b.writeUInt32BE(solution.counter); return b; })(),
      ]))
      .digest()
      .toString('hex')
      .toLowerCase();

    expect(hash.startsWith('000')).toBe(true);
  });

  it('solvePow difficulty 4 produces four leading zeros', () => {
    const salt = `test-${crypto.randomBytes(8).toString('hex')}`;
    const nonce = crypto.randomBytes(8).toString('hex');
    const parameters = {
      algorithm: 'SHA-256',
      nonce,
      salt: Buffer.from(salt).toString('hex'),
      cost: 1,
      keyLength: 32,
      keyPrefix: '0000',
    };

    const solution = solver.solvePow(parameters);
    const hash = crypto
      .createHash('sha256')
      .update(Buffer.concat([
        Buffer.from(salt),
        Buffer.from(nonce, 'hex'),
        (() => { const b = Buffer.alloc(4); b.writeUInt32BE(solution.counter); return b; })(),
      ]))
      .digest()
      .toString('hex')
      .toLowerCase();

    expect(hash.startsWith('0000')).toBe(true);
  });
});
