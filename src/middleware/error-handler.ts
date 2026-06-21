import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

function buildErrorResponse(status: string, version: string, code: number, message: string, format: string) {
  const response = {
    'subsonic-response': {
      status,
      version,
      error: { code, message },
    },
  };

  if (format === 'json') {
    return response;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<subsonic-response xmlns="http://subsonic.org/restapi" status="${status}" version="${version}">
  <error code="${code}" message="${escapeXml(message)}"/>
</subsonic-response>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function detectFormat(request: FastifyRequest): string {
  const url = request.url;
  if (url.includes('f=json')) return 'json';
  if (url.includes('f=xml')) return 'xml';
  // Default to XML for Subsonic compatibility
  return 'xml';
}

export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const format = detectFormat(request);
  let statusCode = 500;
  let subsonicCode = 0;
  let message = 'Internal server error';

  if (error instanceof SyntaxError || (error as any).statusCode === 400) {
    statusCode = 400;
    subsonicCode = 10;
    message = 'Invalid parameter';
  } else if (error.message?.includes('not found') || error.message?.includes('NotFound')) {
    statusCode = 404;
    subsonicCode = 70;
    message = error.message;
  } else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
    statusCode = 504;
    subsonicCode = 0;
    message = 'Gateway timeout';
  } else if ((error as any).statusCode === 502 || error.message?.includes('fetch failed')) {
    statusCode = 502;
    subsonicCode = 0;
    message = 'Upstream server error';
  }

  const body = buildErrorResponse('failed', '1.16.1', subsonicCode, message, format);
  const contentType = format === 'json' ? 'application/json' : 'text/xml';

  return reply.status(statusCode).header('Content-Type', contentType).send(body);
}
