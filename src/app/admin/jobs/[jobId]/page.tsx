import AdminJobDetailClient from "@/components/v2/AdminJobDetailClient";

export default async function AdminJobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <AdminJobDetailClient jobId={jobId} />;
}