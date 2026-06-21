import { describe, it, expect } from 'vitest';
import { extractAllParameters } from '../../../src/services/subsonic/request-parser.js';
import { buildMockRequest } from '../../mocks.js';

describe('SubsonicRequestParser', () => {
  it('extractAllParameters reads query string', async () => {
    const request = buildMockRequest({
      query: { u: 'testuser', p: 'testpass', v: '1.16.1', c: 'TestApp' },
      method: 'GET',
    });

    const result = await extractAllParameters(request);
    expect(result.u).toBe('testuser');
    expect(result.p).toBe('testpass');
    expect(result.v).toBe('1.16.1');
    expect(result.c).toBe('TestApp');
  });

  it('extractAllParameters reads form body for POST request', async () => {
    const request = buildMockRequest({
      query: {},
      body: { u: 'user', p: 'pass', f: 'json' },
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
    });

    const result = await extractAllParameters(request);
    expect(result.u).toBe('user');
    expect(result.p).toBe('pass');
    expect(result.f).toBe('json');
  });

  it('extractAllParameters merges query and body, body takes priority', async () => {
    const request = buildMockRequest({
      query: { u: 'queryuser', f: 'xml' },
      body: { u: 'bodyuser', p: 'pass' },
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
    });

    const result = await extractAllParameters(request);
    expect(result.u).toBe('bodyuser');
    expect(result.f).toBe('xml');
    expect(result.p).toBe('pass');
  });

  it('extractAllParameters returns empty for empty request', async () => {
    const request = buildMockRequest({ query: {}, method: 'GET' });
    const result = await extractAllParameters(request);
    expect(Object.keys(result)).toHaveLength(0);
  });
});
