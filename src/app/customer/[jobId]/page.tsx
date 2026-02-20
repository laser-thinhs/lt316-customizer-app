import CustomerEditorClient from "@/components/v2/CustomerEditorClient";

export default async function CustomerJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <CustomerEditorClient initialJobId={jobId} />;
}
