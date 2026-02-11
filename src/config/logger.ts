import pino from 'pino';
import { env } from './env';

export const logger = pino({
    level: env.LOG_LEVEL,
    transport: env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    } : undefined,
    base: {
        service: 'dispatch-service',
        env: env.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});
