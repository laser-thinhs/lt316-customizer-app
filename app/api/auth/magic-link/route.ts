import { NextResponse } from 'next/server';
import { magicLinkRequestSchema } from '@/lib/validators';

export async function POST(request: Request) {
  const body = await request.json();
  const result = magicLinkRequestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const token = crypto.randomUUID();
  console.info('Magic link placeholder token generated', {
    email: result.data.email,
    token
  });

  return NextResponse.json({ message: 'Magic link placeholder generated. Check server logs.' });
}
