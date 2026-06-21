import Fastify from 'fastify';
import { getConfig } from './config/settings.js';
import { authPreHandler } from './middleware/auth.js';
import { bodyBufferPreHandler } from './middleware/body-buffer.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRoute } from './routes/health.js';
import { subsonicRoutes } from './routes/subsonic.js';
import { SubsonicProxyService, SubsonicModelMapper } from './services/subsonic/model-mapper.js';
import { SquidWTFProviderFactory } from './services/providers/factory.js';
import { SquidWTFMetadataService } from './services/squidwtf/metadata-service.js';
import { BaseDownloadService } from './services/download/download-service.js';
import { parseSongId } from './utils/id-helper.js';

export async function buildApp() {
  const config = getConfig();

  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
    bodyLimit: 10 * 1024 * 1024,
  });

  app.setErrorHandler(errorHandler);

  app.addHook('preHandler', authPreHandler);
  app.addHook('preHandler', bodyBufferPreHandler);

  // Real services
  const proxyService = new SubsonicProxyService();
  const modelMapper = new SubsonicModelMapper();
  const providerFactory = new SquidWTFProviderFactory();
  const metadataService = new SquidWTFMetadataService(providerFactory);
  const downloadService = new BaseDownloadService();

  // Placeholder local library service
  const localLibraryService = {
    parseSongId: (id: string) => parseSongId(id),
    getLocalPathForExternalSongAsync: async (_provider: string, _externalId: string) => {
      // Check if the downloaded file exists
      return null;
    },
    waitForLocalIdAfterScanAsync: async () => null,
    triggerLibraryScanAsync: async () => false,
  };

  await healthRoute(app);
  await subsonicRoutes(app, {
    proxyService,
    modelMapper,
    metadataService,
    downloadService,
    localLibraryService,
  });

  return app;
}
