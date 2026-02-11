# 5G Health Platform - Dispatch Service

This service acts as the central orchestrator for emergency response. It consumes patient alerts, validates them, creates dispatch records, and assigns resources (ambulances/hospitals).

## Features
- **Event Driven**: Consumes `patient.alert.raised` from NATS JetStream.
- **Validation**: Enforces strict JSON Schema (Ajv 2020) on ingress/egress.
- **Persistence**: Stores dispatch lifecycle in Postgres.
- **Auditable**: Publishes `dispatch.created` and `dispatch.assigned` events.

## Architecture
1. **Ingestion**: Listens to `patient.alert.raised` on the `events` stream.
2. **Decision**: Checks severity (High/Medium -> Dispatch, Low -> Ignore).
3. **Execution**: 
   - Creates DB Record.
   - Publishes `dispatch.created`.
   - Selects resource (Round-robin/Dummy for MVP).
   - Updates DB.
   - Publishes `dispatch.assigned`.
   - Acks original message only on full success.

## Environment Variables
| Variable | Descripton | Default |
|----------|------------|---------|
| PORT | HTTP Port | 8093 |
| DATABASE_URL | Postgres connection string | - |
| NATS_URL | NATS Server URL | nats://localhost:4222 |
| CONTRACTS_PATH | Path to JSON schemas | ./contracts |

## Quick Start
### Prerequisites
- Docker & Docker Compose
- Node.js >= 18

### Local Run
1. Start Infrastructure:
   ```bash
   docker-compose up -d
   ```
2. Run Service:
   ```bash
   npm install
   npm run dev
   ```

### Testing
- Unit Tests: `npm test`
- Integration: `npm run test:integration` (Requires infra running)

## API
- `GET /health`: Health check
- `GET /ready`: Readiness probe
- `GET /dispatches`: List dispatches

## Deployment
Build the docker image:
```bash
docker build -t 5g-health-dispatch-service .
```
