export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Template Detail: {id}</h1>
      <p className="text-sm text-gray-600">Manage token definitions and apply template.</p>
    </main>
  );
}
