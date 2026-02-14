import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  const job = await prisma.jobSubmission.findUnique({
    where: { id },
    include: {
      productTemplate: true,
      asset: true
    }
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const payload = {
    jobId: job.id,
    createdAt: job.createdAt,
    template: {
      id: job.productTemplate.id,
      name: job.productTemplate.name,
      diameterMm: job.productTemplate.diameterMm,
      heightMm: job.productTemplate.heightMm,
      engravingArea: {
        widthMm: job.productTemplate.engravingAreaWidthMm,
        heightMm: job.productTemplate.engravingAreaHeightMm
      },
      lightburnDefaults: job.productTemplate.lightburnDefaults
    },
    asset: {
      id: job.asset.id,
      url: job.asset.url,
      mimeType: job.asset.mimeType
    },
    transform: job.transform
  };

  return NextResponse.json({ payload });
}
