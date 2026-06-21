import { FastifyRequest } from 'fastify';

export async function extractAllParameters(request: FastifyRequest): Promise<Record<string, string>> {
  const params: Record<string, string> = {};

  // Query string params
  const query = request.query as Record<string, string>;
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') {
        params[key] = value;
      }
    }
  }

  // Form body params (POST with application/x-www-form-urlencoded)
  if (request.body && typeof request.body === 'object') {
    const body = request.body as Record<string, unknown>;
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') {
        params[key] = value;
      }
    }
  }

  return params;
}
