import { JobStatus, Prisma } from '@prisma/client';
import prisma from './db';

export interface CreateJobParams {
  type: string;
  payload?: Prisma.InputJsonValue;
  runAt?: Date;
  maxAttempts?: number;
}

export async function enqueueJob(params: CreateJobParams) {
  return prisma.job.create({
    data: {
      type: params.type,
      payload: params.payload ?? Prisma.JsonNull,
      runAt: params.runAt ?? new Date(),
      maxAttempts: params.maxAttempts ?? 3,
    },
  });
}

export async function claimJobs(limit = 10) {
  const now = new Date();
  
  const jobs = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "Job"
    SET status = ${JobStatus.PROCESSING}::"JobStatus",
        "lockedAt" = ${now},
        attempts = attempts + 1,
        "updatedAt" = ${now}
    WHERE id IN (
      SELECT id FROM "Job"
      WHERE status = ${JobStatus.PENDING}::"JobStatus"
        AND "runAt" <= ${now}
      ORDER BY "runAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;

  if (jobs.length === 0) {
    return [];
  }

  return prisma.job.findMany({
    where: {
      id: {
        in: jobs.map(j => j.id),
      },
    },
  });
}

export async function markJobCompleted(jobId: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.COMPLETED,
      lastError: null,
    },
  });
}

export async function markJobFailed(
  jobId: string,
  error: string,
  maxAttempts: number
) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { attempts: true },
  });

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const isDead = job.attempts >= maxAttempts;
  const nextRunAt = isDead ? null : calculateNextRunAt(job.attempts);

  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: isDead ? JobStatus.DEAD : JobStatus.FAILED,
      lastError: error,
      runAt: nextRunAt ?? undefined,
    },
  });
}

function calculateNextRunAt(attempts: number): Date {
  const baseDelay = 60;
  const delaySeconds = Math.min(baseDelay * Math.pow(2, attempts - 1), 3600);
  return new Date(Date.now() + delaySeconds * 1000);
}
