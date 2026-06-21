import { getConfig } from '../../config/settings.js';

export class SquidWTFInstanceManager {
  private cachedInstances: string[] | null = null;
  private lastFetch = 0;
  private static readonly CACHE_DURATION_MS = 15 * 60 * 1000;
  private initLock = false;
  private pendingInit: Promise<string[]> | null = null;

  async getInstancesAsync(): Promise<string[]> {
    const config = getConfig();
    const instancesUrl = config.SQUIDWTF__INSTANCES_URL;

    // Check env-configured static instances (comma-separated string)
    const envInstancesRaw = config.SQUIDWTF__INSTANCES;
    if (envInstancesRaw) {
      const parsed = envInstancesRaw.split(',').map(s => s.trim()).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }

    // Check cache
    if (this.cachedInstances && Date.now() - this.lastFetch < SquidWTFInstanceManager.CACHE_DURATION_MS) {
      return this.cachedInstances;
    }

    // Deduplicate concurrent fetches
    if (this.pendingInit) return this.pendingInit;

    this.pendingInit = this.fetchInstancesAsync(instancesUrl);
    try {
      const instances = await this.pendingInit;
      this.cachedInstances = instances;
      this.lastFetch = Date.now();
      return instances;
    } finally {
      this.pendingInit = null;
    }
  }

  private async fetchInstancesAsync(instancesUrl?: string): Promise<string[]> {
    // Try to fetch from URL first
    if (instancesUrl) {
      try {
        const res = await fetch(instancesUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json() as string[];
          if (Array.isArray(data) && data.length > 0) return data;
        }
      } catch {
        // Fall through to default
      }
    }

    return ['https://monochrome-api.samidy.com/'];
  }

  async sendWithFailoverAsync(
    requestFn: (instance: string) => Promise<Response>,
    signal?: AbortSignal,
  ): Promise<Response> {
    const config = getConfig();
    const instances = await this.getInstancesAsync();
    const timeoutMs = (config.SQUIDWTF__INSTANCE_TIMEOUT_SECONDS || 5) * 1000;

    let lastError: Error | null = null;

    for (const instance of instances) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await requestFn(instance);
        clearTimeout(timeoutId);

        if (response.ok || response.status === 404) {
          return response;
        }

        lastError = new Error(`Instance returned ${response.status}`);
      } catch (err: any) {
        if (err.name === 'AbortError' && signal?.aborted) throw err;
        lastError = err;
      }
    }

    throw lastError || new Error('All Tidal API instances failed');
  }

  resetCache(): void {
    this.cachedInstances = null;
    this.lastFetch = 0;
  }
}
