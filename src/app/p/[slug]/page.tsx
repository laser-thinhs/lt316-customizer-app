import { readLayout } from "@/lib/page-layout/storage.server";
import { PageLayoutRenderer } from "@/sections/PageLayoutRenderer";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PublicPageRoute({ params }: Props) {
  const { slug } = await params;
  const { layout, error } = await readLayout(slug);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl bg-slate-50 px-4 py-8">
      {error ? <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{error}</p> : null}
      <PageLayoutRenderer layout={layout} />
    </main>
  );
}
