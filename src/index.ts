import { loadConfig } from './config/settings.js';
import { buildApp } from './server.js';

async function main() {
  const config = loadConfig();

  console.log(`Active streaming provider: ${config.SQUIDWTF__SOURCE}`);
  console.log(`Storage mode: ${config.SQUIDSUB__STORAGE_MODE}`);

  try {
    const navRes = await fetch(`${config.NAVIDROME_URL}/rest/ping.view`);
    if (navRes.ok) {
      console.log(`Navidrome reachable at ${config.NAVIDROME_URL}`);
    } else {
      console.warn(`Navidrome returned status ${navRes.status}`);
    }
  } catch {
    console.warn(`Navidrome not reachable at ${config.NAVIDROME_URL} — will retry at first request`);
  }

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
