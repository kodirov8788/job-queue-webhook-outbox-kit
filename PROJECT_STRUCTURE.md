# Project Structure

```
job-queue-webhook-outbox-kit/
├── app/                              # Next.js 14 App Router
│   ├── api/                          # API Routes
│   │   ├── health/                   
│   │   │   └── route.ts              # Health check endpoint
│   │   ├── jobs/                     
│   │   │   ├── [id]/route.ts         # Get job by ID
│   │   │   └── route.ts              # List/create jobs
│   │   ├── webhooks/                 
│   │   │   ├── endpoints/route.ts    # Manage webhook endpoints
│   │   │   └── outbox/route.ts       # Manage webhook outbox
│   │   ├── worker/                   
│   │   │   └── tick/route.ts         # Worker/cron endpoint
│   │   └── demo/                     
│   │       └── receiver/route.ts     # Demo webhook receiver
│   ├── globals.css                   # Global styles (Tailwind)
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Homepage with demo UI
│
├── lib/                              # Core library code
│   ├── db.ts                         # Prisma client singleton
│   ├── crypto.ts                     # Webhook signature functions
│   ├── queue.ts                      # Job queue logic
│   ├── webhook.ts                    # Webhook outbox logic
│   └── __tests__/                    
│       └── crypto.test.ts            # Crypto unit tests
│
├── prisma/                           
│   └── schema.prisma                 # Database schema
│
├── examples/                         # Usage examples
│   ├── api-examples.http             # REST Client test collection
│   ├── custom-jobs.md                # Custom job type examples
│   └── webhook-receivers.md          # Webhook receiver examples
│
├── .github/                          
│   └── workflows/                    
│       └── ci.yml                    # GitHub Actions CI workflow
│
├── README.md                         # Main documentation
├── DEPLOYMENT.md                     # Deployment guide
├── CONTRIBUTING.md                   # Contribution guide
├── PROJECT_STRUCTURE.md              # This file
│
├── .env.example                      # Environment variables template
├── .gitignore                        # Git ignore rules
├── .nvmrc                            # Node version specification
├── .eslintrc.json                    # ESLint configuration
│
├── next.config.js                    # Next.js configuration
├── tsconfig.json                     # TypeScript configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── postcss.config.mjs                # PostCSS configuration
├── vercel.json                       # Vercel deployment config + cron
├── package.json                      # Dependencies and scripts
└── package-lock.json                 # Locked dependencies
```

## Directory Breakdown

### `/app` - Next.js Application
All application code following Next.js 14 App Router conventions.

#### `/app/api` - API Routes
RESTful API endpoints for managing jobs and webhooks:

- **Health** - Database connectivity check
- **Jobs** - Create, list, and retrieve background jobs
- **Webhooks/Endpoints** - Register and manage webhook receivers
- **Webhooks/Outbox** - Queue and track outbound webhook events
- **Worker** - Process jobs and webhooks (cron-triggered)
- **Demo/Receiver** - Built-in webhook receiver for testing

#### `/app/page.tsx` - Demo UI
Interactive dashboard showing:
- Quick actions (enqueue job, register endpoint, etc.)
- Live stats (job counts, webhook counts)
- Recent jobs table
- Webhook outbox table
- Registered endpoints list
- Received events log

### `/lib` - Core Business Logic
Reusable library functions that can be imported anywhere:

- **db.ts** - Prisma client with singleton pattern
- **crypto.ts** - HMAC-SHA256 signature generation/verification
- **queue.ts** - Job enqueueing, claiming, and status updates
- **webhook.ts** - Webhook outbox enqueueing and delivery

### `/prisma` - Database Schema
Prisma ORM schema defining:
- Job queue tables
- Webhook endpoint registry
- Webhook outbox and delivery audit
- Demo receiver storage

### `/examples` - Documentation & Examples
- **api-examples.http** - Complete API test suite for REST Client
- **custom-jobs.md** - Email, data sync, reports, image processing examples
- **webhook-receivers.md** - Receivers in multiple languages with security best practices

### Root Configuration Files

| File | Purpose |
|------|---------|
| `README.md` | Main documentation, API reference, quick start |
| `DEPLOYMENT.md` | Step-by-step Vercel + Neon deployment guide |
| `CONTRIBUTING.md` | Development workflow, PR guidelines |
| `.env.example` | Required environment variables template |
| `vercel.json` | Vercel cron configuration (runs worker every minute) |
| `tsconfig.json` | TypeScript strict mode configuration |
| `package.json` | Dependencies, scripts, Node version requirements |

## Key Design Patterns

### 1. Optimistic Locking
Jobs and outbox items are claimed using `FOR UPDATE SKIP LOCKED`:
```sql
UPDATE "Job" SET status = 'PROCESSING'
WHERE id IN (
  SELECT id FROM "Job" WHERE status = 'PENDING'
  LIMIT 10 FOR UPDATE SKIP LOCKED
)
```

### 2. Exponential Backoff
Failed items are retried with increasing delays:
- Attempt 1: 60 seconds
- Attempt 2: 120 seconds  
- Attempt 3: 240 seconds
- Max delay: 1 hour

### 3. Dead Letter Queue
Items exceeding `maxAttempts` are marked `DEAD` for manual investigation.

### 4. Webhook Signing
All webhooks include HMAC-SHA256 signature:
```typescript
const signature = generateWebhookSignature(body, secret);
// X-Webhook-Signature: abc123...
```

### 5. Audit Trail
Every webhook delivery attempt is logged in `WebhookDelivery` table.

## Data Flow

### Job Processing Flow
1. Client calls `POST /api/jobs` → Job created with status `PENDING`
2. Cron triggers `POST /api/worker/tick` every minute
3. Worker claims pending jobs using optimistic locking
4. Job status → `PROCESSING`
5. Worker executes job logic
6. On success: status → `COMPLETED`
7. On failure: status → `FAILED`, schedule retry with backoff
8. After max attempts: status → `DEAD`

### Webhook Delivery Flow
1. Client calls `POST /api/webhooks/outbox` → Outbox item created
2. Cron triggers worker
3. Worker claims pending outbox items
4. Generate HMAC signature for payload
5. HTTP POST to endpoint URL with signature headers
6. Log delivery attempt in `WebhookDelivery` table
7. On 2xx response: status → `DELIVERED`
8. On error: status → `FAILED`, schedule retry
9. After max attempts: status → `DEAD`

## Testing Strategy

### Manual Testing
- Demo UI at `/` for interactive testing
- REST Client with `examples/api-examples.http`

### Unit Tests
- Example test for crypto functions in `lib/__tests__/crypto.test.ts`
- Run with test framework (not included, add Jest/Vitest as needed)

### Integration Testing
- Build check: `npm run build`
- Type check: `npx tsc --noEmit`
- Lint: `npm run lint`
- CI runs all checks on every push (`.github/workflows/ci.yml`)

## Environment Variables

Required for all environments:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection (pooled) | `postgresql://user:pass@host/db` |
| `DIRECT_URL` | Postgres connection (direct) | Same as DATABASE_URL for Neon |
| `WEBHOOK_SIGNING_SECRET` | Global webhook secret | `openssl rand -hex 32` |
| `CRON_SECRET` | Worker endpoint protection | `openssl rand -hex 32` |

Optional:
| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `production` in production |
| `NEXT_PUBLIC_CRON_SECRET` | For demo UI worker button (dev only) |

## Deployment Checklist

- [ ] Database provisioned (Neon recommended)
- [ ] Environment variables configured in Vercel
- [ ] `npm run db:push` executed to initialize schema
- [ ] Vercel deployment successful
- [ ] Cron jobs registered (check Vercel dashboard)
- [ ] Health check returns `{"ok":true,"db":true}`
- [ ] Demo workflow completes end-to-end

## Scaling Considerations

### Current Limits (per worker tick)
- 10 jobs processed
- 10 webhooks delivered
- 60 second function timeout

### To Scale Up
1. Increase batch size in `worker/tick/route.ts`
2. Deploy worker as separate function with higher timeout
3. Use Neon connection pooling (automatic)
4. Add database indexes (already included in schema)
5. Consider multiple regions (Vercel + Neon multi-region)

## Monitoring Recommendations

Track these metrics:
- Jobs processed per minute
- Jobs in DEAD status (should be near zero)
- Webhook delivery success rate
- Worker execution time (should be under 60s)
- Database connection pool saturation

## License

MIT

## Support

- Issues: GitHub Issues
- Docs: README.md, DEPLOYMENT.md, CONTRIBUTING.md
- Examples: `/examples` directory
