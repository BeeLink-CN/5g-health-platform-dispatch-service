import { connect, NatsConnection, JetStreamClient, JetStreamManager } from 'nats';
import { env } from '../config/env';
import { logger } from '../config/logger';

let nc: NatsConnection | undefined;
let js: JetStreamClient | undefined;
let jsm: JetStreamManager | undefined;

export async function connectNats() {
    try {
        logger.info({ url: env.NATS_URL }, 'Connecting to NATS...');
        nc = await connect({ servers: env.NATS_URL });
        js = nc.jetstream();
        jsm = await nc.jetstreamManager();
        logger.info('Connected to NATS JetStream');

        // Ensure 'events' stream exists (MVP assumption)
        try {
            await jsm.streams.add({
                name: 'events',
                subjects: ['patient.alert.raised', 'dispatch.*']
            });
            logger.info('Stream "events" asserted');
        } catch (e: any) {
            // Ignore if exists, or handle error
            logger.debug('Stream ensure check: ' + e.message);
        }

        return { nc, js, jsm };
    } catch (err) {
        logger.error({ err }, 'Failed to connect to NATS');
        process.exit(1);
    }
}

export function getNats() {
    if (!nc || !js) {
        throw new Error('NATS not initialized');
    }
    return { nc, js, jsm };
}

export async function closeNats() {
    if (nc) {
        await nc.drain();
        await nc.close();
    }
}
