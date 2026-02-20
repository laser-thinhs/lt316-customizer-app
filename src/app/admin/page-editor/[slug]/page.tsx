import PageEditorClient from "@/components/admin/PageEditor/PageEditorClient";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function AdminPageEditorRoute({ params }: Props) {
  const { slug } = await params;

  return <PageEditorClient slug={slug} />;
}
