import fastify, { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { getNats } from '../nats/connection';
import { pool, query } from '../db';

export function createServer(): FastifyInstance {
    const app = fastify({ logger: false }); // We use our own logger

    app.get('/health', async () => {
        return { status: 'ok' };
    });

    app.get('/ready', async (_, reply) => {
        try {
            // Check DB
            await query('SELECT 1');
            // Check NATS
            const { nc } = getNats();
            if (nc.isClosed()) throw new Error('NATS closed');

            return { status: 'ready' };
        } catch (err: any) {
            reply.code(503).send({ status: 'not ready', error: err.message });
        }
    });

    app.get('/dispatches', async (req: any) => {
        const { patient_id, limit = 20, offset = 0 } = req.query;
        let text = 'SELECT * FROM dispatches';
        const params: any[] = [];

        if (patient_id) {
            text += ' WHERE patient_id = $1';
            params.push(patient_id);
        }

        text += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const res = await query(text, params);
        return { data: res.rows };
    });

    app.get('/dispatches/:id', async (req: any, reply) => {
        const { id } = req.params;
        const res = await query('SELECT * FROM dispatches WHERE dispatch_id = $1', [id]);
        if (res.rowCount === 0) {
            reply.code(404).send({ error: 'Not found' });
            return;
        }
        return res.rows[0];
    });

    // POST /dispatches/:id/status
    app.post('/dispatches/:id/status', async (req: any, reply) => {
        const { id } = req.params;
        const { status } = req.body; // e.g. 'completed', 'cancelled'

        // Validate allowed transitions (simple check)
        if (!['created', 'assigned', 'on_route', 'on_scene', 'transporting', 'completed', 'cancelled'].includes(status)) {
            reply.code(400).send({ error: 'Invalid status' });
            return;
        }

        const update = await query(
            'UPDATE dispatches SET status = $1, updated_at = NOW() WHERE dispatch_id = $2 RETURNING *',
            [status, id]
        );

        if (update.rowCount === 0) {
            reply.code(404).send({ error: 'Not found' });
            return;
        }

        return update.rows[0];
    });

    return app;
}
