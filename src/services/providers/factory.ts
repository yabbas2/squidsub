import { ISquidWTFProvider } from './interface.js';
import { QobuzProvider } from './qobuz-provider.js';
import { AmazonMusicProvider } from './amazon-provider.js';
import { TidalProvider } from './tidal-provider.js';
import { getConfig } from '../../config/settings.js';

export class SquidWTFProviderFactory {
  private _provider: ISquidWTFProvider | null = null;

  getProvider(): ISquidWTFProvider {
    if (this._provider) return this._provider;
    const config = getConfig();
    const source = config.SQUIDWTF__SOURCE;

    switch (source) {
      case 'qobuz':
        this._provider = new QobuzProvider();
        break;
      case 'amazon':
        this._provider = new AmazonMusicProvider();
        break;
      case 'tidal':
        this._provider = new TidalProvider();
        break;
      default:
        throw new Error(`Provider "${source}" is not yet implemented in the Node.js rewrite`);
    }

    return this._provider;
  }

  setProvider(p: ISquidWTFProvider): void {
    this._provider = p;
  }

  resetProvider(): void {
    this._provider = null;
  }
}
