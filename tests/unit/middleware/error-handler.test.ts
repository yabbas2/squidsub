import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../../../src/middleware/error-handler.js';

function mockReply() {
  const reply: Record<string, any> = {};
  let statusCode = 200;
  let sentBody: unknown = null;
  const headers: Record<string, string> = {};

  reply.status = (code: number) => {
    statusCode = code;
    return reply;
  };
  reply.header = (key: string, value: string) => {
    headers[key] = value;
    return reply;
  };
  reply.send = (body: unknown) => {
    sentBody = body;
    return reply;
  };
  reply._getStatus = () => statusCode;
  reply._getBody = () => sentBody;
  reply._getHeaders = () => headers;

  return reply;
}

function mockRequest(url: string) {
  return { url };
}

describe('ErrorHandler', () => {
  it('returns 404 for not found errors', async () => {
    const reply = mockReply() as any;
    const req = mockRequest('/rest/ping.view?f=json') as any;
    await errorHandler(new Error('file not found'), req, reply);
    expect(reply._getStatus()).toBe(404);
    const body = reply._getBody() as any;
    expect(body['subsonic-response'].error.code).toBe(70);
  });

  it('returns 504 for timeout errors', async () => {
    const reply = mockReply() as any;
    const req = mockRequest('/rest/ping.view?f=json') as any;
    await errorHandler(new Error('timeout'), req, reply);
    expect(reply._getStatus()).toBe(504);
  });

  it('returns 502 for fetch failed errors', async () => {
    const reply = mockReply() as any;
    const req = mockRequest('/rest/ping.view?f=json') as any;
    await errorHandler(new Error('fetch failed'), req, reply);
    expect(reply._getStatus()).toBe(502);
  });

  it('returns 500 for generic errors', async () => {
    const reply = mockReply() as any;
    const req = mockRequest('/rest/ping.view?f=json') as any;
    await errorHandler(new Error('bad state'), req, reply);
    expect(reply._getStatus()).toBe(500);
    const body = reply._getBody() as any;
    expect(body['subsonic-response'].error.code).toBe(0);
  });

  it('returns 400 for syntax errors', async () => {
    const reply = mockReply() as any;
    const req = mockRequest('/rest/ping.view?f=json') as any;
    await errorHandler(new SyntaxError('Unexpected token'), req, reply);
    expect(reply._getStatus()).toBe(400);
    const body = reply._getBody() as any;
    expect(body['subsonic-response'].error.code).toBe(10);
  });

  it('returns always (no throw)', async () => {
    const reply = mockReply() as any;
    const req = mockRequest('/rest/ping.view?f=json') as any;
    await expect(errorHandler(new Error('test'), req, reply)).resolves.not.toThrow();
  });
});
