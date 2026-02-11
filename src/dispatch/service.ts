import { JsMsg } from 'nats';
import { v4 as uuidv4 } from 'uuid';
import { schemaValidator } from '../contracts/schema-validator';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { pool, query } from '../db';
import { publishEvent } from '../nats/publisher';
import { alertConsumer } from '../nats/consumer';

export async function processAlert(msg: JsMsg, alert: any) {
    const { subject } = msg;
    logger.info({ subject, alert_id: alert.alert_id }, 'Received alert');

    // 1. Validate Schema
    const validation = schemaValidator.validate('patient.alert.raised', alert);
    if (!validation.valid) {
        logger.warn({ errors: validation.errors }, 'Invalid alert schema, dropping');
        // Ack poison pill to prevent redelivery loop
        msg.ack();
        return;
    }

    const { alert_id, patient_id, severity, timestamp: alertTimestamp } = alert;

    // 2. Decide whether to dispatch
    // MVP: dispatch if severity is medium/high or absent.
    // If low, ignore (ack).
    const sev = (severity || '').toLowerCase();
    if (sev === 'low') {
        logger.info({ alert_id, sev }, 'Severity low, ignoring alert');
        msg.ack();
        return;
    }

    // Idempotency check: check if alert already processed
    const existing = await query('SELECT dispatch_id FROM dispatches WHERE alert_id = $1', [alert_id]);
    if (existing.rowCount && existing.rowCount > 0) {
        logger.info({ alert_id }, 'Alert already processed, acking duplicate');
        msg.ack();
        return;
    }

    const client = await pool.connect();
    try {
        const dispatchId = uuidv4();
        const now = new Date().toISOString();

        // 3. Create Dispatch Record (Status: CREATED)
        await client.query('BEGIN');

        await client.query(
            `INSERT INTO dispatches 
       (dispatch_id, patient_id, alert_id, severity, status, created_at, updated_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [dispatchId, patient_id, alert_id, sev, 'created', now, now, alert]
        );

        // 4. Publish dispatch.created
        const createdEvent = {
            dispatch_id: dispatchId,
            patient_id,
            alert_id,
            severity: sev,
            timestamp: now,
            status: 'created',
            payload: alert
        };
        await publishEvent('dispatch.created', createdEvent);

        // 5. Assignment Logic (MVP: Dummy)
        // Environment based selection
        const ambulances = env.AMBULANCE_IDS.split(',');
        const hospitals = env.HOSPITAL_IDS.split(',');

        const assignedAmbulance = ambulances[0]; // Simple first available
        const assignedHospital = hospitals[0];

        // 6. Update Record (Status: ASSIGNED)
        await client.query(
            `UPDATE dispatches 
         SET status = $1, chosen_ambulance_id = $2, chosen_hospital_id = $3, updated_at = $4
         WHERE dispatch_id = $5`,
            ['assigned', assignedAmbulance, assignedHospital, now, dispatchId]
        );

        // 7. Publish dispatch.assigned
        const assignedEvent = {
            dispatch_id: dispatchId,
            ambulance_id: assignedAmbulance,
            hospital_id: assignedHospital,
            timestamp: now,
            status: 'assigned'
        };
        await publishEvent('dispatch.assigned', assignedEvent);

        // 8. Commit & Ack
        await client.query('COMMIT');
        msg.ack();
        logger.info({ dispatch_id: dispatchId }, 'Dispatch processed successfully');

    } catch (err) {
        await client.query('ROLLBACK');
        logger.error({ err, alert_id }, 'Failed to process alert dispatch');
        // Nak with delay for retry
        msg.nak(2000);
    } finally {
        client.release();
    }
}

export async function startDispatchService() {
    // Ensure schemas loaded
    schemaValidator.loadSchemas();

    // Start consumer
    await alertConsumer.startSubscription(processAlert);
}
