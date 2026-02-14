import { NextResponse } from 'next/server';
import { productTemplateSchema } from '@/lib/validators';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const payload = await request.json();
  const result = productTemplateSchema.safeParse(payload);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const template = await prisma.productTemplate.create({
    data: result.data
  });

  return NextResponse.json({ template }, { status: 201 });
}
