import { NextRequest, NextResponse } from 'next/server';
import { claimJobs, markJobCompleted, markJobFailed } from '@/lib/queue';
import { claimOutboxItems, deliverWebhook } from '@/lib/webhook';

export const maxDuration = 60;

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  const secretHeader = request.headers.get('x-cron-secret');

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === cronSecret;
  }

  if (secretHeader) {
    return secretHeader === cronSecret;
  }

  return false;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    jobsProcessed: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    webhooksProcessed: 0,
    webhooksDelivered: 0,
    webhooksFailed: 0,
    errors: [] as string[],
  };

  try {
    const jobs = await claimJobs(10);
    results.jobsProcessed = jobs.length;

    for (const job of jobs) {
      try {
        await processJob(job);
        await markJobCompleted(job.id);
        results.jobsCompleted++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await markJobFailed(job.id, errorMessage, job.maxAttempts);
        results.jobsFailed++;
        results.errors.push(`Job ${job.id}: ${errorMessage}`);
      }
    }

    const webhookSigningSecret = process.env.WEBHOOK_SIGNING_SECRET || 'default-secret';
    const outboxItems = await claimOutboxItems(10);
    results.webhooksProcessed = outboxItems.length;

    for (const item of outboxItems) {
      const secret = item.endpoint.secret || webhookSigningSecret;
      const result = await deliverWebhook(
        item.id,
        item.endpoint.url,
        item.eventType,
        item.payload,
        secret
      );

      if (result.success) {
        results.webhooksDelivered++;
      } else {
        results.webhooksFailed++;
        results.errors.push(`Webhook ${item.id}: ${result.error}`);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      {
        ...results,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

async function processJob(job: any): Promise<void> {
  switch (job.type) {
    case 'test':
      await new Promise(resolve => setTimeout(resolve, 100));
      break;
    case 'email':
      console.log(`[Job ${job.id}] Sending email:`, job.payload);
      break;
    case 'data_sync':
      console.log(`[Job ${job.id}] Syncing data:`, job.payload);
      break;
    default:
      console.log(`[Job ${job.id}] Processing job type "${job.type}":`, job.payload);
  }
}
