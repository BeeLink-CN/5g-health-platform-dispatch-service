import { JSONCodec } from 'nats';
import { getNats } from './connection';
import { logger } from '../config/logger';

const jc = JSONCodec();

export async function publishEvent(subject: string, data: any) {
    const { js } = getNats();
    try {
        const pa = await js.publish(subject, jc.encode(data));
        logger.debug({ subject, seq: pa.seq }, 'Published event');
        return pa;
    } catch (err) {
        logger.error({ subject, err }, 'Failed to publish event');
        throw err;
    }
}
