import { FastifyInstance } from 'fastify';

export async function healthRoute(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok', service: 'squidsub-node' });
  });
}
