import { Codec, JSONCodec, JsMsg, AckPolicy } from 'nats';
import { getNats } from './connection';
import { logger } from '../config/logger';
import { env } from '../config/env';

export type AlertHandler = (msg: JsMsg, data: any) => Promise<void>;

export class AlertConsumer {
    private jc: Codec<any>;

    constructor() {
        this.jc = JSONCodec();
    }

    public async startSubscription(handler: AlertHandler) {
        const { js, jsm } = getNats();
        const stream = 'events';
        const subject = 'patient.alert.raised';
        const durableName = 'dispatch-service-alert-consumer';

        logger.info({ subject, durableName }, 'Starting consumer subscription');

        // Ensure consumer exists
        try {
            if (jsm) {
                await jsm.consumers.add(stream, {
                    durable_name: durableName,
                    ack_policy: AckPolicy.Explicit,
                    filter_subject: subject,
                });
            }
        } catch (e) {
            logger.warn({ err: e }, 'Error ensuring consumer');
        }

        const sub = await js.consumers.get(stream, durableName);
        const messages = await sub.consume();

        logger.info('Consumer running...');

        for await (const m of messages) {
            try {
                const data = this.jc.decode(m.data);
                await handler(m, data);
            } catch (err) {
                logger.error({ err }, 'Error processing message');
                // If handler failed unexpectedly, nak with delay
                m.nak(1000);
            }
        }
    }
}

export const alertConsumer = new AlertConsumer();
