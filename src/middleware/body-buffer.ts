import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Ensures the request body can be re-read multiple times by enabling buffering.
 * Fastify already buffers the body by default, so this is mainly a no-op
 * that ensures body-parsed content is available.
 */
export async function bodyBufferPreHandler(request: FastifyRequest, _reply: FastifyReply) {
  // Fastify already parses and buffers the body.
  // This hook ensures we've waited for body parsing if needed.
  if (request.body === undefined) {
    // For GET requests or requests without body, params come from query string
    return;
  }
}
