import { cleanEnv, str, num, url } from 'envalid';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file if it exists
dotenv.config();

export const env = cleanEnv(process.env, {
    NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
    PORT: num({ default: 8093 }),
    DATABASE_URL: url(),
    NATS_URL: str({ default: 'nats://localhost:4222' }),
    CONTRACTS_PATH: str({ default: path.join(process.cwd(), 'contracts') }),
    AMBULANCE_IDS: str({ default: 'amb-1,amb-2' }),
    HOSPITAL_IDS: str({ default: 'ank-001,ank-002' }),
    LOG_LEVEL: str({ default: 'info' }),
});
