import { connect, NatsConnection, JSONCodec } from 'nats';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';

// This test assumes a running environment (e.g. docker-compose or CI services)
describe('Dispatch Service Integration Flow', () => {
    let nc: NatsConnection;
    let pool: Pool;
    const jc = JSONCodec();

    beforeAll(async () => {
        // Connect to infra
        nc = await connect({ servers: env.NATS_URL });
        pool = new Pool({ connectionString: env.DATABASE_URL });
    });

    afterAll(async () => {
        await nc.drain();
        await nc.close();
        await pool.end();
    });

    it('should create a dispatch and publish events when alert is raised', async () => {
        const alertId = uuidv4();
        const patientId = 'patient-integration-001';
        const alert = {
            alert_id: alertId,
            patient_id: patientId,
            severity: 'high',
            timestamp: new Date().toISOString(),
            message: 'Integration Test'
        };

        // We need to subscribe to dispatch.created to verify output
        // We use a promise to wait for it
        const dispatchCreatedPromise = new Promise<any>(async (resolve, reject) => {
            const sub = nc.subscribe('dispatch.created');
            for await (const m of sub) {
                const data = jc.decode(m.data) as any;
                if (data.alert_id === alertId) {
                    resolve(data);
                    break;
                }
            }
        });

        const dispatchAssignedPromise = new Promise<any>(async (resolve, reject) => {
            const sub = nc.subscribe('dispatch.assigned');
            for await (const m of sub) {
                const data = jc.decode(m.data) as any;
                // logic to match dispatch_id would be ideal but we don't have it yet
                // assuming flow order, checking structure
                if (data.status === 'assigned') {
                    resolve(data);
                    break;
                }
            }
        });

        // Publish alert
        const js = nc.jetstream();
        await js.publish('patient.alert.raised', jc.encode(alert));

        // Wait for dispatch created
        const createdEvent = await dispatchCreatedPromise;
        expect(createdEvent).toBeDefined();
        expect(createdEvent.patient_id).toBe(patientId);
        expect(createdEvent.dispatch_id).toBeDefined();

        // Verify DB insertion
        const res = await pool.query('SELECT * FROM dispatches WHERE dispatch_id = $1', [createdEvent.dispatch_id]);
        expect(res.rowCount).toBe(1);
        expect(res.rows[0].status).toBe('assigned'); // Should be assigned by end of flow
        expect(res.rows[0].chosen_ambulance_id).toBeTruthy();

        const assignedEvent = await dispatchAssignedPromise;
        expect(assignedEvent.dispatch_id).toBe(createdEvent.dispatch_id);
    });
});
