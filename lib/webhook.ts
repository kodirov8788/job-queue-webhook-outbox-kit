import { OutboxStatus, Prisma } from '@prisma/client';
import prisma from './db';
import { generateWebhookSignature } from './crypto';

export interface CreateOutboxParams {
  endpointId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
  maxAttempts?: number;
}

export async function enqueueWebhook(params: CreateOutboxParams) {
  return prisma.webhookOutbox.create({
    data: {
      endpointId: params.endpointId,
      eventType: params.eventType,
      payload: params.payload,
      maxAttempts: params.maxAttempts ?? 5,
    },
  });
}

export async function claimOutboxItems(limit = 10) {
  const now = new Date();

  const items = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "WebhookOutbox"
    SET status = ${OutboxStatus.DELIVERING}::"OutboxStatus",
        attempts = attempts + 1,
        "updatedAt" = ${now}
    WHERE id IN (
      SELECT id FROM "WebhookOutbox"
      WHERE status = ${OutboxStatus.PENDING}::"OutboxStatus"
        AND "nextAttemptAt" <= ${now}
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;

  if (items.length === 0) {
    return [];
  }

  return prisma.webhookOutbox.findMany({
    where: {
      id: {
        in: items.map(i => i.id),
      },
    },
    include: {
      endpoint: true,
    },
  });
}

export async function deliverWebhook(
  outboxId: string,
  endpointUrl: string,
  eventType: string,
  payload: Prisma.JsonValue,
  secret: string
) {
  const timestamp = new Date().toISOString();
  const body = JSON.stringify(payload);
  const signature = generateWebhookSignature(body, secret);

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Event-Type': eventType,
      },
      body,
    });

    const responseBody = await response.text();
    const statusCode = response.status;

    await prisma.webhookDelivery.create({
      data: {
        outboxId,
        attempt: (await prisma.webhookOutbox.findUnique({
          where: { id: outboxId },
          select: { attempts: true },
        }))!.attempts,
        statusCode,
        responseBody: responseBody.substring(0, 1000),
      },
    });

    if (response.ok) {
      await prisma.webhookOutbox.update({
        where: { id: outboxId },
        data: {
          status: OutboxStatus.DELIVERED,
          lastStatusCode: statusCode,
          deliveredAt: new Date(),
        },
      });
      return { success: true, statusCode };
    } else {
      throw new Error(`HTTP ${statusCode}: ${responseBody}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const outbox = await prisma.webhookOutbox.findUnique({
      where: { id: outboxId },
      select: { attempts: true, maxAttempts: true },
    });

    if (!outbox) {
      throw new Error(`Outbox item ${outboxId} not found`);
    }

    const isDead = outbox.attempts >= outbox.maxAttempts;
    const nextAttemptAt = isDead ? null : calculateNextAttemptAt(outbox.attempts);

    await prisma.webhookOutbox.update({
      where: { id: outboxId },
      data: {
        status: isDead ? OutboxStatus.DEAD : OutboxStatus.FAILED,
        lastError: errorMessage.substring(0, 1000),
        nextAttemptAt: nextAttemptAt ?? undefined,
      },
    });

    return { success: false, error: errorMessage };
  }
}

function calculateNextAttemptAt(attempts: number): Date {
  const baseDelay = 60;
  const delaySeconds = Math.min(baseDelay * Math.pow(2, attempts - 1), 3600);
  return new Date(Date.now() + delaySeconds * 1000);
}
