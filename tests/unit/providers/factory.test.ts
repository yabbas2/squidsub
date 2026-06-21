import { describe, it, expect, vi, afterEach } from 'vitest';
import { SquidWTFProviderFactory } from '../../../src/services/providers/factory.js';
import { getConfig } from '../../../src/config/settings.js';

vi.mock('../../../src/config/settings.js');

describe('SquidWTFProviderFactory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a QobuzProvider when source is qobuz', () => {
    vi.mocked(getConfig).mockReturnValue({
      SQUIDWTF__SOURCE: 'qobuz',
    } as any);

    const factory = new SquidWTFProviderFactory();
    const provider = factory.getProvider();
    expect(provider.constructor.name).toBe('QobuzProvider');
  });

  it('returns a TidalProvider when source is tidal', () => {
    vi.mocked(getConfig).mockReturnValue({
      SQUIDWTF__SOURCE: 'tidal',
    } as any);

    const factory = new SquidWTFProviderFactory();
    const provider = factory.getProvider();
    expect(provider.constructor.name).toBe('TidalProvider');
  });

  it('returns an AmazonMusicProvider when source is amazon', () => {
    vi.mocked(getConfig).mockReturnValue({
      SQUIDWTF__SOURCE: 'amazon',
    } as any);

    const factory = new SquidWTFProviderFactory();
    const provider = factory.getProvider();
    expect(provider.constructor.name).toBe('AmazonMusicProvider');
  });

  it('throws for unknown source', () => {
    vi.mocked(getConfig).mockReturnValue({
      SQUIDWTF__SOURCE: 'unknown',
    } as any);

    const factory = new SquidWTFProviderFactory();
    expect(() => factory.getProvider()).toThrow();
  });
});
