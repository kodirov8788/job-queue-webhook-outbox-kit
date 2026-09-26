import { NextRequest, NextResponse } from 'next/server';
import { enqueueJob } from '@/lib/queue';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, payload, runAt, maxAttempts } = body;

    if (!type || typeof type !== 'string') {
      return NextResponse.json(
        { error: 'Field "type" is required and must be a string' },
        { status: 400 }
      );
    }

    const job = await enqueueJob({
      type,
      payload,
      runAt: runAt ? new Date(runAt) : undefined,
      maxAttempts,
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const status = searchParams.get('status');

    const jobs = await prisma.job.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(jobs);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
