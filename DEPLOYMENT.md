# Deployment Guide

## Quick Deploy to Vercel + Neon

### 1. Create Neon Database

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project
3. Copy the connection string (it will look like: `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`)

### 2. Deploy to Vercel

#### Option A: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts to create project
```

#### Option B: GitHub Integration

1. Push code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "New Project"
4. Import your GitHub repository
5. Configure as Next.js project (auto-detected)

### 3. Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | Your Neon connection string | Production, Preview, Development |
| `DIRECT_URL` | Same Neon connection string | Production, Preview, Development |
| `WEBHOOK_SIGNING_SECRET` | Generate with `openssl rand -hex 32` | Production, Preview, Development |
| `CRON_SECRET` | Generate with `openssl rand -hex 32` | Production, Preview, Development |

💡 **Tip**: You can use the same connection string for both `DATABASE_URL` and `DIRECT_URL` with Neon.

### 4. Initialize Database

```bash
# Set local environment variables first
export DATABASE_URL="postgresql://..."
export DIRECT_URL="postgresql://..."

# Push schema to database
npm run db:push
```

Or use Vercel CLI:

```bash
vercel env pull .env.local
npm run db:push
```

### 5. Verify Deployment

Visit your deployed URL:

1. Homepage should load with demo UI
2. Click through the demo workflow:
   - Enqueue Test Job
   - Register Demo Endpoint
   - Enqueue Webhook Event
   - Run Worker Now

3. Check `/api/health` returns `{"ok":true,"db":true}`

### 6. Enable Cron Jobs

Cron jobs are automatically configured in `vercel.json` to run daily at midnight UTC. **Note**: Vercel Hobby plans reject sub-daily cron schedules; the worker is configured for daily execution. For testing or demos, manually trigger the worker endpoint.

1. Make sure your deployment is to a production domain
2. Verify in Vercel Dashboard → Deployments → [Your deployment] → Functions → Cron Jobs
3. The worker will run once daily automatically

To test cron manually:

```bash
curl -X POST https://your-app.vercel.app/api/worker/tick \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

## Local Development Setup

### Prerequisites

- Node.js 18+
- Postgres database (Neon recommended for easiest setup)

### Steps

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
# Get free database from: https://neon.tech

# Initialize database
npm run db:push

# Start dev server
npm run dev
```

Visit http://localhost:3000

## Testing Webhooks Locally

### Using ngrok

```bash
# Install ngrok
brew install ngrok  # or download from ngrok.com

# Start your app
npm run dev

# In another terminal, expose it
ngrok http 3000

# Use the ngrok URL when registering webhook endpoints
```

### Manual Testing

```bash
# Enqueue a job
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"type":"test","payload":{"foo":"bar"}}'

# Register endpoint
curl -X POST http://localhost:3000/api/webhooks/endpoints \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-receiver.com/webhook","description":"My webhook"}'

# Enqueue webhook event
curl -X POST http://localhost:3000/api/webhooks/outbox \
  -H "Content-Type: application/json" \
  -d '{"endpointId":"clx...","eventType":"test.event","payload":{"data":"value"}}'

# Process worker (use your CRON_SECRET from .env)
curl -X POST http://localhost:3000/api/worker/tick \
  -H "x-cron-secret: your-cron-secret"
```

## Environment Variables Reference

### Required

- **DATABASE_URL**: PostgreSQL connection string (with pooling for serverless)
- **DIRECT_URL**: Direct PostgreSQL connection string (for migrations)
- **WEBHOOK_SIGNING_SECRET**: Secret for signing webhook payloads
- **CRON_SECRET**: Secret to protect worker endpoint

### Optional

- **NODE_ENV**: Set to `production` in production (Vercel does this automatically)
- **NEXT_PUBLIC_CRON_SECRET**: For demo UI worker button (dev only, not recommended for production)

## Troubleshooting

### "Environment variable not found: DATABASE_URL"

This is normal during build if environment variables aren't set at build time. Vercel handles this correctly.

### Cron jobs not running

- Cron jobs only run on production deployments
- Check Vercel Dashboard → Settings → Cron Jobs to verify they're registered
- Manually trigger with `curl` to test worker endpoint

### Webhook signature verification fails

- Ensure `WEBHOOK_SIGNING_SECRET` is consistent between sender and receiver
- Check that you're using the raw request body (not parsed JSON) for signature
- Verify timing-safe comparison is used (our implementation does this)

### Database connection errors

- For Neon: Make sure connection string includes `?sslmode=require`
- For connection pooling: Use the pooled connection string for `DATABASE_URL`
- For migrations: Use the direct connection string for `DIRECT_URL`

### Worker endpoint returns 401

- Verify `CRON_SECRET` environment variable is set
- Ensure you're passing the secret in `x-cron-secret` header or `Authorization: Bearer` header
- Check the secret matches exactly (no extra whitespace)

## Production Checklist

- [ ] Strong `WEBHOOK_SIGNING_SECRET` generated (32+ characters)
- [ ] Strong `CRON_SECRET` generated (32+ characters)
- [ ] Database connection string uses SSL (`?sslmode=require`)
- [ ] Cron jobs verified in Vercel dashboard
- [ ] Health check endpoint returns success
- [ ] Demo workflow completes end-to-end
- [ ] Webhook signature verification tested
- [ ] Monitor dead letter queue for failed items
- [ ] Set up alerts for high failure rates
- [ ] Review and adjust `maxAttempts` if needed
- [ ] Database backups configured (Neon does this automatically)

## Monitoring

### Key Metrics to Monitor

1. **Job Processing Rate**: Jobs completed vs. failed
2. **Webhook Delivery Rate**: Webhooks delivered vs. failed
3. **Dead Letter Queue Size**: Items in DEAD status
4. **Worker Execution Time**: Should be under 60s
5. **Database Performance**: Query latency and connection pool usage

### Recommended Tools

- **Vercel Analytics**: Built-in for function execution metrics
- **Prisma Pulse** (optional): Real-time database change streams
- **Sentry** (optional): Error tracking and alerting
- **Custom Dashboard**: Query stats from Job/WebhookOutbox tables

## Scaling Considerations

### Database

- **Neon**: Automatically scales read replicas and connection pooling
- **Indexes**: Schema includes indexes on `status` and timestamp fields
- **Connection Pooling**: Use pooled connection string for `DATABASE_URL`

### Worker Processing

- Adjust batch size in `/app/api/worker/tick/route.ts` (currently 10)
- Consider multiple workers for higher throughput:
  - Increase cron frequency (current: every minute)
  - Deploy worker as separate function with higher timeout
  - Use `FOR UPDATE SKIP LOCKED` ensures no duplicate processing

### Webhook Delivery

- Consider webhook batching for high-volume endpoints
- Implement circuit breaker for consistently failing endpoints
- Add rate limiting per endpoint if needed

## Support

For issues or questions:

1. Check the [README](./README.md) for API documentation
2. Review this deployment guide for common issues
3. Open an issue on GitHub
4. Check [Neon documentation](https://neon.tech/docs) for database questions
5. Check [Vercel documentation](https://vercel.com/docs) for deployment questions
