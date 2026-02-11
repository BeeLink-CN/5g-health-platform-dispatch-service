import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const pool = new Pool({
    connectionString: env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export const getClient = async (): Promise<PoolClient> => pool.connect();

export async function runMigrations() {
    const client = await pool.connect();
    try {
        logger.info('Running migrations check...');

        // Ensure migrations directory exists
        const migrationPath = path.join(__dirname, 'migrations');

        if (fs.existsSync(migrationPath)) {
            const files = fs.readdirSync(migrationPath).sort();
            for (const file of files) {
                if (file.endsWith('.sql')) {
                    const sql = fs.readFileSync(path.join(migrationPath, file), 'utf-8');
                    await client.query(sql);
                    logger.info({ file }, 'Executed migration');
                }
            }
        } else {
            // Fallback for simple setup if folder missing
            logger.info('Migrations folder not found, ensuring base schema via inline SQL');
            await client.query(`
          CREATE TABLE IF NOT EXISTS dispatches (
            dispatch_id UUID PRIMARY KEY,
            patient_id VARCHAR(255) NOT NULL,
            alert_id VARCHAR(255),
            severity VARCHAR(50),
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            chosen_hospital_id VARCHAR(255),
            chosen_ambulance_id VARCHAR(255),
            payload JSONB
          );
        `);
        }

        logger.info('Migrations completed successfully');
    } catch (err) {
        logger.error({ err }, 'Migration failed');
        throw err;
    } finally {
        client.release();
    }
}

export async function closeDb() {
    await pool.end();
}
