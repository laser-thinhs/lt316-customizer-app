export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Batch Run {id}</h1>
      <p className="text-sm text-gray-600">Track progress, row outcomes, and export errors CSV.</p>
    </main>
  );
}
