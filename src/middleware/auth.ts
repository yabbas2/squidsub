import { FastifyRequest, FastifyReply } from 'fastify';
import { extractAllParameters } from '../services/subsonic/request-parser.js';
import { tryFromDictionary, SubsonicCredentials } from '../utils/credentials.js';
import { getConfig } from '../config/settings.js';
import crypto from 'node:crypto';

interface AuthCache {
  hash: string;
  expiresAt: number;
}

const cache = new Map<string, AuthCache>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function makeHash(username: string, password: string): string {
  return `${username}:${password}`;
}

function validateAgainstConfig(creds: SubsonicCredentials): boolean {
  const config = getConfig();
  const adminUser = config.NAVIDROME_ADMIN_USERNAME;
  const adminPass = config.NAVIDROME_ADMIN_PASSWORD;

  if (!adminUser || !adminPass) return false; // fall through to Navidrome ping

  if (creds.username !== adminUser) return false;

  if (creds.token && creds.salt) {
    // Token-based auth: md5(password + salt) should match token
    const expected = crypto.createHash('md5').update(adminPass + creds.salt).digest('hex');
    return creds.token === expected;
  }

  return creds.password === adminPass;
}

async function validateAgainstNavidrome(creds: SubsonicCredentials): Promise<boolean> {
  const config = getConfig();
  const params = new URLSearchParams({ u: creds.username, v: '1.16.1', c: 'squidsub' });

  if (creds.token && creds.salt) {
    params.set('t', creds.token);
    params.set('s', creds.salt);
  } else {
    params.set('p', creds.password);
  }

  try {
    const res = await fetch(`${config.NAVIDROME_URL}/rest/ping.view?${params}`);
    // Navidrome returns HTTP 200 with a Subsonic error body for bad creds
    if (!res.ok) return false;
    const text = await res.text();
    return !text.includes('status="failed"') && !text.includes('"status":"failed"');
  } catch {
    return false;
  }
}

export async function authPreHandler(request: FastifyRequest, reply: FastifyReply) {
  // Public paths skip auth
  const publicPaths = ['/health', '/swagger'];
  if (publicPaths.some(p => request.url.startsWith(p))) return;

  const params = await extractAllParameters(request);
  const creds = tryFromDictionary(params);

  if (!creds) {
    return sendAuthError(reply, 'Missing authentication parameters', request.url);
  }

  const hash = makeHash(creds.username, creds.password || creds.token || '');
  const cached = cache.get(hash);

  if (cached && Date.now() < cached.expiresAt) {
    return;
  }

  // Try config-based auth first, fall back to Navidrome ping
  const valid = validateAgainstConfig(creds) || await validateAgainstNavidrome(creds);

  if (!valid) {
    return sendAuthError(reply, 'Wrong username or password', request.url);
  }

  cache.set(hash, { hash, expiresAt: Date.now() + CACHE_TTL });
}

function sendAuthError(reply: FastifyReply, message: string, url: string) {
  const format = url.includes('f=json') || url.includes('.view?') && !url.includes('f=xml') ? 'json' : 'xml';
  const response = {
    'subsonic-response': {
      status: 'failed',
      version: '1.16.1',
      error: { code: 40, message },
    },
  };

  if (format === 'json') {
    return reply.status(401).header('Content-Type', 'application/json').send(response);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<subsonic-response xmlns="http://subsonic.org/restapi" status="failed" version="1.16.1">
  <error code="40" message="${escapeXml(message)}"/>
</subsonic-response>`;

  return reply.status(401).header('Content-Type', 'text/xml').send(xml);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
