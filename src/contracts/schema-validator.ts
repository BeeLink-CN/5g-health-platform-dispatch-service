import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class SchemaValidator {
    private ajv: Ajv;
    private schemasLoaded = false;

    constructor() {
        this.ajv = new Ajv({
            allErrors: true,
            strict: false, // Allow unknown keywords like 'service' if present in shared contracts
            validateSchema: false // simpler for now
        });
        addFormats(this.ajv);
    }

    public loadSchemas(): void {
        if (this.schemasLoaded) return;

        const schemaPath = env.CONTRACTS_PATH;
        logger.info({ schemaPath }, 'Loading schemas from path');

        try {
            if (!fs.existsSync(schemaPath)) {
                logger.warn({ schemaPath }, 'Contracts path does not exist, creating placeholder');
                fs.mkdirSync(schemaPath, { recursive: true });
                return;
            }

            this.loadSchemasRecursively(schemaPath);
            this.schemasLoaded = true;
            logger.info('Schemas loaded successfully');
        } catch (error) {
            logger.error({ error }, 'Failed to load schemas');
            throw error;
        }
    }

    private loadSchemasRecursively(dir: string): void {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                this.loadSchemasRecursively(fullPath);
            } else if (file.endsWith('.json')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const schema = JSON.parse(content);
                    // Only add if it has an $id and isn't already added
                    if (schema.$id && !this.ajv.getSchema(schema.$id)) {
                        this.ajv.addSchema(schema);
                        logger.debug({ id: schema.$id }, 'Loaded schema');
                    }
                } catch (err) {
                    logger.warn({ file, err }, 'Skipping invalid schema file');
                }
            }
        }
    }

    public validate(schemaId: string, data: unknown): { valid: boolean; errors?: string[] } {
        const validate = this.ajv.getSchema(schemaId);
        if (!validate) {
            logger.warn({ schemaId }, 'Schema not found during validation');
            return { valid: false, errors: [`Schema ${schemaId} not found`] };
        }

        const valid = validate(data);
        if (!valid) {
            const errors = validate.errors?.map(e => `${e.instancePath} ${e.message}`) || ['Unknown error'];
            return { valid: false, errors };
        }

        return { valid: true };
    }
}

export const schemaValidator = new SchemaValidator();
