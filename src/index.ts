import { loadConfig } from './config/settings.js';
import { buildApp } from './server.js';

async function main() {
  const config = loadConfig();

  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`SquidSub listening on ${config.HOST}:${config.PORT}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
