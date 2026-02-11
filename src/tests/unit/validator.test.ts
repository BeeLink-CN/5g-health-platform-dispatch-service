import { schemaValidator } from '../../contracts/schema-validator';
import path from 'path';

describe('Schema Validator', () => {
    beforeAll(() => {
        // Point to actual or mock schemas
        // For unit test, we can assume loadSchemas works if path is correct
        // But better to mock fs or use the actual dummy schemas we created
        schemaValidator.loadSchemas();
    });

    it('should validate a correct patient.alert.raised event', () => {
        const event = {
            alert_id: '123',
            patient_id: 'p-1',
            severity: 'high',
            timestamp: new Date().toISOString(),
            message: 'Help'
        };
        const res = schemaValidator.validate('patient.alert.raised', event);
        expect(res.valid).toBe(true);
    });

    it('should fail validation on missing required field', () => {
        const event = {
            patient_id: 'p-1',
            // missing alert_id
        };
        const res = schemaValidator.validate('patient.alert.raised', event);
        expect(res.valid).toBe(false);
        expect(res.errors![0]).toContain('alert_id');
    });
});
