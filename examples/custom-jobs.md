# Custom Job Types - Examples

This guide shows how to extend the job queue with custom job types.

## Example 1: Email Notification Job

### 1. Define the Job Type

```typescript
// lib/jobs/email.ts
import { enqueueJob } from '@/lib/queue';

export interface EmailJobPayload {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export async function enqueueEmailJob(payload: EmailJobPayload) {
  return enqueueJob({
    type: 'send_email',
    payload,
    maxAttempts: 3,
  });
}
```

### 2. Add Processing Logic

```typescript
// app/api/worker/tick/route.ts
import nodemailer from 'nodemailer'; // npm install nodemailer

async function processJob(job: any): Promise<void> {
  switch (job.type) {
    case 'send_email':
      await processEmailJob(job.payload);
      break;
    // ... other cases
  }
}

async function processEmailJob(payload: EmailJobPayload) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: payload.from || process.env.DEFAULT_FROM_EMAIL,
    to: payload.to,
    subject: payload.subject,
    html: payload.body,
  });
}
```

### 3. Use in API Route

```typescript
// app/api/users/[id]/send-welcome/route.ts
import { enqueueEmailJob } from '@/lib/jobs/email';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getUser(params.id);
  
  await enqueueEmailJob({
    to: user.email,
    subject: 'Welcome!',
    body: `<h1>Welcome ${user.name}!</h1>`,
  });

  return Response.json({ success: true });
}
```

## Example 2: Data Sync Job

### 1. Define the Job Type

```typescript
// lib/jobs/sync.ts
export interface DataSyncJobPayload {
  source: string;
  destination: string;
  filters?: Record<string, any>;
}

export async function enqueueDataSync(payload: DataSyncJobPayload) {
  return enqueueJob({
    type: 'data_sync',
    payload,
    maxAttempts: 5, // More retries for data sync
  });
}
```

### 2. Add Processing Logic

```typescript
async function processJob(job: any): Promise<void> {
  switch (job.type) {
    case 'data_sync':
      await processDataSync(job.payload);
      break;
    // ...
  }
}

async function processDataSync(payload: DataSyncJobPayload) {
  const sourceData = await fetchFromSource(payload.source, payload.filters);
  
  for (const item of sourceData) {
    await writeToDestination(payload.destination, item);
  }
}
```

## Example 3: Scheduled Report Job

### 1. Define and Schedule

```typescript
// lib/jobs/reports.ts
export async function scheduleMonthlyReport(userId: string) {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);

  return enqueueJob({
    type: 'generate_report',
    payload: {
      userId,
      reportType: 'monthly',
      period: nextMonth.toISOString(),
    },
    runAt: nextMonth,
    maxAttempts: 3,
  });
}
```

### 2. Add Processing Logic

```typescript
async function processJob(job: any): Promise<void> {
  switch (job.type) {
    case 'generate_report':
      await processReportJob(job.payload);
      break;
    // ...
  }
}

async function processReportJob(payload: any) {
  const data = await fetchReportData(payload.userId, payload.period);
  const pdf = await generatePDF(data);
  
  await enqueueEmailJob({
    to: await getUserEmail(payload.userId),
    subject: `Your ${payload.reportType} Report`,
    body: 'Please find your report attached.',
    attachments: [{ filename: 'report.pdf', content: pdf }],
  });
}
```

## Example 4: Image Processing Job

### 1. Define the Job Type

```typescript
// lib/jobs/images.ts
export interface ImageProcessingPayload {
  imageUrl: string;
  operations: Array<'resize' | 'watermark' | 'optimize'>;
  dimensions?: { width: number; height: number };
  outputBucket: string;
}

export async function enqueueImageProcessing(payload: ImageProcessingPayload) {
  return enqueueJob({
    type: 'process_image',
    payload,
    maxAttempts: 3,
  });
}
```

### 2. Add Processing Logic

```typescript
import sharp from 'sharp'; // npm install sharp
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function processJob(job: any): Promise<void> {
  switch (job.type) {
    case 'process_image':
      await processImageJob(job.payload);
      break;
    // ...
  }
}

async function processImageJob(payload: ImageProcessingPayload) {
  const imageBuffer = await fetch(payload.imageUrl).then(r => r.arrayBuffer());
  let image = sharp(Buffer.from(imageBuffer));

  for (const operation of payload.operations) {
    switch (operation) {
      case 'resize':
        if (payload.dimensions) {
          image = image.resize(payload.dimensions.width, payload.dimensions.height);
        }
        break;
      case 'optimize':
        image = image.jpeg({ quality: 80 });
        break;
      case 'watermark':
        // Add watermark logic
        break;
    }
  }

  const processed = await image.toBuffer();
  
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  await s3.send(new PutObjectCommand({
    Bucket: payload.outputBucket,
    Key: `processed-${Date.now()}.jpg`,
    Body: processed,
  }));
}
```

## Example 5: Webhook Fan-out Job

Process one event and fan it out to multiple webhooks:

```typescript
// lib/jobs/fanout.ts
export async function fanOutWebhook(eventType: string, payload: any) {
  return enqueueJob({
    type: 'webhook_fanout',
    payload: { eventType, data: payload },
    maxAttempts: 1, // Don't retry fan-out, retry individual deliveries
  });
}

async function processJob(job: any): Promise<void> {
  switch (job.type) {
    case 'webhook_fanout':
      await processFanOut(job.payload);
      break;
    // ...
  }
}

async function processFanOut(payload: { eventType: string; data: any }) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { isActive: true },
  });

  for (const endpoint of endpoints) {
    await enqueueWebhook({
      endpointId: endpoint.id,
      eventType: payload.eventType,
      payload: payload.data,
    });
  }
}
```

## Best Practices

### 1. Job Payload Design

```typescript
// ✅ Good: Type-safe, versioned payload
interface MyJobPayload {
  version: '1.0';
  userId: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, any>;
}

// ❌ Bad: Untyped, no versioning
type MyJobPayload = any;
```

### 2. Error Handling

```typescript
async function processMyJob(payload: MyJobPayload) {
  try {
    await riskyOperation(payload);
  } catch (error) {
    // Log with context
    console.error('[Job Processing Error]', {
      jobType: 'my_job',
      payload,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Re-throw to trigger retry
    throw error;
  }
}
```

### 3. Idempotency

```typescript
async function processPaymentJob(payload: PaymentJobPayload) {
  // Check if already processed
  const existing = await prisma.payment.findUnique({
    where: { idempotencyKey: payload.idempotencyKey },
  });
  
  if (existing) {
    console.log('Payment already processed, skipping');
    return;
  }
  
  // Process payment...
  await processPayment(payload);
}
```

### 4. Monitoring

```typescript
async function processJob(job: any): Promise<void> {
  const startTime = Date.now();
  
  try {
    switch (job.type) {
      case 'my_job':
        await processMyJob(job.payload);
        break;
    }
    
    const duration = Date.now() - startTime;
    console.log(`[Job Success] type=${job.type} duration=${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Job Failed] type=${job.type} duration=${duration}ms`, error);
    throw error;
  }
}
```

### 5. Testing

```typescript
// Test job enqueueing
describe('Email Job', () => {
  it('should enqueue email job with correct payload', async () => {
    const job = await enqueueEmailJob({
      to: 'test@example.com',
      subject: 'Test',
      body: 'Hello',
    });
    
    expect(job.type).toBe('send_email');
    expect(job.status).toBe('PENDING');
    expect(job.payload).toMatchObject({
      to: 'test@example.com',
    });
  });
});
```

## Common Patterns

### Delayed Jobs

```typescript
// Run 1 hour from now
const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

await enqueueJob({
  type: 'reminder',
  payload: { userId: '123', message: 'Check your inbox' },
  runAt: oneHourFromNow,
});
```

### Job Chaining

```typescript
async function processParentJob(payload: any) {
  const results = await doSomething(payload);
  
  // Enqueue follow-up jobs
  for (const result of results) {
    await enqueueJob({
      type: 'child_job',
      payload: { parentId: payload.id, data: result },
    });
  }
}
```

### Batch Processing

```typescript
async function processBatchJob(payload: { items: any[] }) {
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < payload.items.length; i += BATCH_SIZE) {
    const batch = payload.items.slice(i, i + BATCH_SIZE);
    await processBatch(batch);
  }
}
```
