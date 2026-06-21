const XOR_KEY = 'gesundheit';

export interface SubsonicCredentials {
  username: string;
  password: string;
  token?: string;
  salt?: string;
  client: string;
  version: string;
}

export function tryFromDictionary(params: Record<string, string>): SubsonicCredentials | null {
  const u = params['u']?.trim();
  let p = params['p']?.trim();
  const t = params['t']?.trim();
  const s = params['s']?.trim();
  const c = params['c']?.trim() || 'unknown';
  const v = params['v']?.trim() || '1.16.1';

  if (!u || (!p && !t)) return null;

  if (p && p.startsWith('enc:')) {
    p = decryptPassword(p);
  }

  return { username: u, password: p || '', token: t, salt: s, client: c, version: v };
}

export function decryptPassword(encrypted: string): string {
  // Remove 'enc:' prefix and hex-decode
  const hex = encrypted.substring(4);
  const bytes = Buffer.from(hex, 'hex');
  const key = Buffer.from(XOR_KEY, 'utf-8');
  const result = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[i] = bytes[i] ^ key[i % key.length];
  }
  return result.toString('utf-8');
}
