import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/crypto';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-webhook-signature');
    const timestamp = request.headers.get('x-webhook-timestamp');
    const eventType = request.headers.get('x-webhook-event-type');

    if (!signature || !timestamp || !eventType) {
      return NextResponse.json(
        { error: 'Missing required webhook headers' },
        { status: 400 }
      );
    }

    const body = await request.text();
    let payload: any;

    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const secret = process.env.WEBHOOK_SIGNING_SECRET || 'default-secret';
    const verified = verifyWebhookSignature(body, signature, secret);

    await prisma.demoReceivedEvent.create({
      data: {
        eventType,
        payload,
        signature,
        timestamp,
        verified,
      },
    });

    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid signature', received: true, verified: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      eventType,
      timestamp,
      message: 'Webhook received and verified',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const events = await prisma.demoReceivedEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
