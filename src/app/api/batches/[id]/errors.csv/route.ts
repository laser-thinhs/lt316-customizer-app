import { getBatchErrorsCsv } from "@/services/batch.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const csv = await getBatchErrorsCsv((await params).id);
  return new Response(csv, { headers: { "content-type": "text/csv" } });
}
