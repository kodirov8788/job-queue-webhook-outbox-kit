import { NextRequest, NextResponse } from 'next/server';
import { enqueueWebhook } from '@/lib/webhook';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpointId, eventType, payload, maxAttempts } = body;

    if (!endpointId || typeof endpointId !== 'string') {
      return NextResponse.json(
        { error: 'Field "endpointId" is required and must be a string' },
        { status: 400 }
      );
    }

    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json(
        { error: 'Field "eventType" is required and must be a string' },
        { status: 400 }
      );
    }

    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
    });

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Webhook endpoint not found' },
        { status: 404 }
      );
    }

    const outbox = await enqueueWebhook({
      endpointId,
      eventType,
      payload: payload ?? {},
      maxAttempts,
    });

    return NextResponse.json(outbox, { status: 201 });
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
    const endpointId = searchParams.get('endpointId');

    const outboxItems = await prisma.webhookOutbox.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(endpointId ? { endpointId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        endpoint: {
          select: {
            url: true,
            description: true,
          },
        },
      },
    });

    return NextResponse.json(outboxItems);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
