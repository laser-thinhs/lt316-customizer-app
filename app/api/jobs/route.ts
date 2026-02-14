import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jobSubmissionSchema } from '@/lib/validators';

export async function POST(request: Request) {
  const body = await request.json();
  const result = jobSubmissionSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const job = await prisma.jobSubmission.create({
    data: result.data
  });

  return NextResponse.json({ job }, { status: 201 });
}
