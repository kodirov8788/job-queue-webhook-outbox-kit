import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, description, secret } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Field "url" is required and must be a string' },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Field "url" must be a valid URL' },
        { status: 400 }
      );
    }

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        url,
        description,
        secret,
      },
    });

    return NextResponse.json(endpoint, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { outboxItems: true },
        },
      },
    });

    return NextResponse.json(endpoints);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
