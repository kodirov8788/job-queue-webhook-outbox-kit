# Job Queue + Webhook Outbox Kit

A production-ready, Postgres-backed job queue with signed webhook outbox, automatic retries, and dead-letter queue. Built with Next.js 14, Prisma, and designed for seamless Vercel deployment.

## Features

- **Postgres-backed Job Queue**: Reliable background job processing with optimistic locking
- **Webhook Outbox Pattern**: Transactional outbox for guaranteed webhook delivery
- **Signed Webhooks**: HMAC-SHA256 signatures for secure webhook verification
- **Automatic Retries**: Exponential backoff for failed jobs and webhooks
- **Dead Letter Queue**: Failed items are marked as "dead" after max attempts
- **Cron Worker**: Automated processing via Vercel Cron Jobs
- **Demo UI**: Interactive demo showing the complete flow
- **Self-contained**: Includes demo webhook receiver for testing

## Architecture

### Job Queue

Jobs are stored in Postgres with status tracking (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `DEAD`). The worker claims jobs using `FOR UPDATE SKIP LOCKED` for safe concurrent processing.

**Retry Strategy**: Exponential backoff starting at 60 seconds, doubling on each attempt, up to 1 hour max delay.

### Webhook Outbox

Outbound webhooks are stored in the outbox table and processed similarly to jobs. Each delivery includes:

- `X-Webhook-Signature`: HMAC-SHA256 signature of the request body
- `X-Webhook-Timestamp`: ISO 8601 timestamp
- `X-Webhook-Event-Type`: Event type identifier

Webhook deliveries are logged in the `WebhookDelivery` audit table.

## Data Model

### Job

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier |
| type | String | Job type (e.g., "email", "data_sync") |
| payload | Json | Job-specific data |
| status | Enum | PENDING, PROCESSING, COMPLETED, FAILED, DEAD |
| attempts | Int | Current attempt count |
| maxAttempts | Int | Maximum retry attempts (default: 3) |
| runAt | DateTime | When the job should run |
| lockedAt | DateTime? | When the job was claimed by worker |
| lastError | String? | Last error message |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

### WebhookEndpoint

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier |
| url | String | Target webhook URL |
| description | String? | Human-readable description |
| secret | String? | Per-endpoint signing secret (optional) |
| isActive | Boolean | Whether endpoint is active |
| createdAt | DateTime | Creation timestamp |

### WebhookOutbox

| Field | Type | Description |
|-------|------|-------------|
| id | String | Unique identifier |
| endpointId | String | Target endpoint |
| eventType | String | Event type (e.g., "user.created") |
| payload | Json | Event data |
| status | Enum | PENDING, DELIVERING, DELIVERED, FAILED, DEAD |
| attempts | Int | Current attempt count |
| maxAttempts | Int | Maximum retry attempts (default: 5) |
| nextAttemptAt | DateTime | When to retry |
| lastStatusCode | Int? | HTTP status from last attempt |
| lastError | String? | Last error message |
| deliveredAt | DateTime? | Successful delivery timestamp |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |

### WebhookDelivery

Audit log of each delivery attempt with status code and response snippet.

## API Documentation

### Health Check

**GET** `/api/health`

Returns system health and database connectivity.

**Response**:
```json
{
  "ok": true,
  "db": true
}
```

---

### Jobs

**POST** `/api/jobs`

Enqueue a new background job.

**Request**:
```json
{
  "type": "email",
  "payload": { "to": "user@example.com", "subject": "Welcome" },
  "runAt": "2024-01-01T00:00:00Z",
  "maxAttempts": 3
}
```

**Response**: `201 Created` with job object

---

**GET** `/api/jobs?limit=50&status=PENDING`

List recent jobs. Query parameters:
- `limit` (optional): Max results, default 50, max 100
- `status` (optional): Filter by status

**Response**: Array of job objects

---

**GET** `/api/jobs/:id`

Get specific job details.

**Response**: Job object or `404 Not Found`

---

### Webhook Endpoints

**POST** `/api/webhooks/endpoints`

Register a webhook endpoint.

**Request**:
```json
{
  "url": "https://example.com/webhooks",
  "description": "Production webhook receiver",
  "secret": "optional-per-endpoint-secret"
}
```

**Response**: `201 Created` with endpoint object

---

**GET** `/api/webhooks/endpoints`

List all registered endpoints.

**Response**: Array of endpoint objects with outbox item counts

---

### Webhook Outbox

**POST** `/api/webhooks/outbox`

Enqueue an outbound webhook event.

**Request**:
```json
{
  "endpointId": "clx...",
  "eventType": "user.created",
  "payload": { "userId": "123", "email": "user@example.com" },
  "maxAttempts": 5
}
```

**Response**: `201 Created` with outbox item object

---

**GET** `/api/webhooks/outbox?limit=50&status=PENDING&endpointId=clx...`

List outbox items. Query parameters:
- `limit` (optional): Max results, default 50, max 100
- `status` (optional): Filter by status
- `endpointId` (optional): Filter by endpoint

**Response**: Array of outbox items with endpoint details

---

### Worker

**POST** `/api/worker/tick`

Process pending jobs and webhook deliveries. Protected by `CRON_SECRET`.

**Headers**:
- `Authorization: Bearer <CRON_SECRET>` OR
- `x-cron-secret: <CRON_SECRET>`

**Response**:
```json
{
  "jobsProcessed": 5,
  "jobsCompleted": 4,
  "jobsFailed": 1,
  "webhooksProcessed": 3,
  "webhooksDelivered": 3,
  "webhooksFailed": 0,
  "errors": []
}
```

---

### Demo Receiver

**POST** `/api/demo/receiver`

Webhook receiver endpoint for testing. Verifies signatures and logs received events.

**GET** `/api/demo/receiver`

List recent received events (last 10).

## Local Setup

### Prerequisites

- Node.js 18+
- Postgres database (local or [Neon](https://neon.tech))

### Installation

1. Clone and install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```bash
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
DIRECT_URL="postgresql://user:password@host/database?sslmode=require"
WEBHOOK_SIGNING_SECRET="your-secret-key-here"
CRON_SECRET="your-cron-secret-here"
```

3. Initialize database:

```bash
npm run db:push
```

4. Start development server:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the demo UI.

## Vercel Deployment

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/job-queue-webhook-outbox-kit)

### Manual Deployment

1. Install Vercel CLI:

```bash
npm i -g vercel
```

2. Deploy:

```bash
vercel
```

3. Configure environment variables in Vercel Dashboard:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `WEBHOOK_SIGNING_SECRET`
   - `CRON_SECRET`

4. Push database schema:

```bash
npm run db:push
```

### Neon Postgres Setup

For the best Vercel deployment experience, use [Neon](https://neon.tech):

1. Create a Neon project
2. Copy the connection string
3. Set both `DATABASE_URL` and `DIRECT_URL` to the connection string
4. Neon automatically handles connection pooling and serverless scaling

## Demo Walkthrough

The demo UI at `/` provides an interactive walkthrough:

1. **Enqueue Test Job**: Creates a test job in the queue
2. **Register Demo Endpoint**: Registers the built-in demo receiver
3. **Enqueue Webhook Event**: Creates an outbound webhook delivery
4. **Run Worker Now**: Manually triggers the worker to process pending items

The dashboard shows:
- Recent jobs with status badges
- Webhook outbox items
- Registered endpoints
- Received events at the demo receiver

In production, the worker runs automatically via Vercel Cron Jobs (see `vercel.json`). **Note**: Vercel Hobby plans only support daily cron schedules; for demos, manually call `/api/worker/tick` to process items immediately.

## Extending Job Types

Add custom job processing in `/app/api/worker/tick/route.ts`:

```typescript
async function processJob(job: any): Promise<void> {
  switch (job.type) {
    case 'send_email':
      await sendEmail(job.payload);
      break;
    case 'generate_report':
      await generateReport(job.payload);
      break;
    default:
      console.log(`Processing job type "${job.type}"`, job.payload);
  }
}
```

## Security Considerations

- **Webhook Signatures**: Always verify `X-Webhook-Signature` in your webhook receivers
- **Cron Secret**: Protect worker endpoints with `CRON_SECRET` to prevent unauthorized execution
- **Database Security**: Use connection pooling and prepared statements (handled by Prisma)
- **HTTPS Only**: Always use HTTPS URLs for webhook endpoints in production

## Production Checklist

- [ ] Set strong `WEBHOOK_SIGNING_SECRET` and `CRON_SECRET`
- [ ] Configure database with connection pooling (Neon handles this automatically)
- [ ] Set up monitoring and alerting for dead-letter items
- [ ] Review and adjust `maxAttempts` for your use case
- [ ] Test webhook signature verification
- [ ] Configure backup retention for audit logs
- [ ] Set appropriate indexes for query performance (included in schema)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Prisma ORM
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Cron**: Vercel Cron Jobs

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a PR.
