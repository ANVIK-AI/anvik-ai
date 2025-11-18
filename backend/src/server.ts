import 'dotenv/config';
import app from './app.js';
import logger from './utils/logger.js';
import { startBoss } from './queue';
import { registerWorkers } from './worker';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  await startBoss(); // ensures boss is connected
  await registerWorkers(); // register worker listener
  logger.info('Queue and workers started');

  app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
