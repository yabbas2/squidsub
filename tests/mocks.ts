import { vi } from 'vitest';

interface MockRequestOptions {
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  method?: string;
  contentType?: string;
}

export function buildMockRequest(opts: MockRequestOptions): any {
  return {
    query: opts.query || {},
    body: opts.body || null,
    method: opts.method || 'GET',
    headers: {
      'content-type': opts.contentType || 'application/json',
    },
  };
}
