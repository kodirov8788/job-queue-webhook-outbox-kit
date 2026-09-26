import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, db: false, error: error instanceof Error ? error.message : String(error) },
      { status: 503 }
    );
  }
}
