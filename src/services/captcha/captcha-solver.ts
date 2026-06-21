import crypto from 'node:crypto';

interface AltchaParameters {
  algorithm: string;
  nonce: string;
  salt: string;
  cost: number;
  keyLength: number;
  keyPrefix: string;
}

interface AltchaChallenge {
  algorithm?: string;
  parameters?: AltchaParameters;
  signature?: string;
}

interface AltchaSolution {
  counter: number;
  derivedKey: string;
  time: number;
}

export class CaptchaSolver {
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;
  private static readonly TOKEN_VALIDITY_MS = 28 * 60 * 1000;

  async solveAltchaChallenge(
    baseUrl: string,
    challengePath = '/api/captcha/challenge',
    verifyPath = '/api/captcha/verify',
    signal?: AbortSignal,
    forceRefresh = false,
  ): Promise<string | null> {
    if (!forceRefresh && this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }

    const challengeUrl = `${baseUrl}${challengePath}`;
    const challengeRes = await fetch(challengeUrl, { signal });
    if (!challengeRes.ok) return null;

    const challenge = await challengeRes.json() as AltchaChallenge;
    if (!challenge?.parameters) return null;

    const solution = this.solvePow(challenge.parameters);

    const payloadObj = {
      challenge: {
        algorithm: challenge.algorithm,
        parameters: challenge.parameters,
        signature: challenge.signature,
      },
      solution: {
        counter: solution.counter,
        derivedKey: solution.derivedKey,
        time: solution.time,
      },
    };
    const payloadBase64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64');

    const verifyRes = await fetch(`${baseUrl}${verifyPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: payloadBase64 }),
      signal,
    });

    if (!verifyRes.ok) {
      const body = await verifyRes.text();
      return null;
    }

    // Check for Set-Cookie header or JSON token
    const setCookie = verifyRes.headers.get('set-cookie');
    if (setCookie) {
      this.cachedToken = setCookie;
      this.tokenExpiry = Date.now() + CaptchaSolver.TOKEN_VALIDITY_MS;
      return this.cachedToken;
    }

    const verifyJson = await verifyRes.json() as any;
    if (verifyJson?.token) {
      this.cachedToken = verifyJson.token;
      this.tokenExpiry = Date.now() + CaptchaSolver.TOKEN_VALIDITY_MS;
      return this.cachedToken;
    }

    return null;
  }

  solvePow(parameters: AltchaParameters): AltchaSolution {
    const start = Date.now();
    const { keyPrefix, salt, nonce, cost, keyLength } = parameters;

    const saltBytes = Buffer.from(salt, 'hex');
    const nonceBytes = Buffer.from(nonce, 'hex');

    // Verification mode: keyPrefix > 8 hex chars (4 bytes)
    if (keyPrefix.length > 8) {
      const password = Buffer.concat([nonceBytes, Buffer.alloc(4)]);
      const derivedKey = crypto.pbkdf2Sync(password, saltBytes, cost, keyLength, 'sha256');
      return {
        counter: 0,
        derivedKey: derivedKey.toString('hex').toLowerCase(),
        time: Date.now() - start,
      };
    }

    // Proof-of-work mode
    const targetPrefix = keyPrefix.toLowerCase();

    for (let counter = 0; counter < 1_000_000; counter++) {
      const counterBuf = Buffer.alloc(4);
      counterBuf.writeUInt32BE(counter);

      const data = Buffer.concat([saltBytes, nonceBytes, counterBuf]);
      let hash = crypto.createHash('sha256').update(data).digest();

      for (let i = 1; i < cost; i++) {
        const truncated = hash.subarray(0, Math.min(hash.length, keyLength));
        hash = crypto.createHash('sha256').update(truncated).digest();
      }

      const finalTruncated = hash.subarray(0, Math.min(hash.length, keyLength));
      const hex = finalTruncated.toString('hex').toLowerCase();

      if (hex.startsWith(targetPrefix)) {
        return {
          counter,
          derivedKey: hex,
          time: Date.now() - start,
        };
      }
    }

    throw new Error('Failed to solve ALTCHA challenge (exceeded 1M iterations)');
  }
}
