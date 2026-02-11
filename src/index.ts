import { env } from './config/env';
import { logger } from './config/logger';
import { runMigrations, closeDb } from './db';
import { connectNats, closeNats } from './nats/connection';
import { startDispatchService } from './dispatch/service';
import { createServer } from './api/server';

async function start() {
    try {
        logger.info('Starting Dispatch Service...');

        // 1. Database
        await runMigrations();

        // 2. NATS
        await connectNats();

        // 3. Dispatch Core (Consumer)
        await startDispatchService();

        // 4. API Server
        const app = createServer();
        await app.listen({ port: env.PORT, host: '0.0.0.0' });

        logger.info(`Server listening on port ${env.PORT}`);

        // Graceful Shutdown
        const shutdown = async () => {
            logger.info('Shutting down...');
            await app.close();
            await closeNats();
            await closeDb();
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (err) {
        logger.fatal({ err }, 'Startup failed');
        process.exit(1);
    }
}

start();
