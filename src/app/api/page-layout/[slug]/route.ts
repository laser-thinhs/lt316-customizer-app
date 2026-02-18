import { NextRequest, NextResponse } from "next/server";
import { readLayout, writeLayout } from "@/lib/page-layout/storage.server";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: NextRequest, { params }: Props) {
  const { slug } = await params;
  const result = await readLayout(slug);

  return NextResponse.json(result);
}

export async function PUT(request: NextRequest, { params }: Props) {
  const { slug } = await params;

  try {
    const payload = await request.json();
    const result = await writeLayout(slug, payload.layout);

    if (!result.layout) {
      return NextResponse.json({ error: result.error ?? "Save failed" }, { status: 400 });
    }

    return NextResponse.json({ layout: result.layout });
  } catch {
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
