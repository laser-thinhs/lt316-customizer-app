import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const templates = await prisma.productTemplate.findMany({
    orderBy: { createdAt: 'asc' }
  });

  return NextResponse.json({ templates });
}
