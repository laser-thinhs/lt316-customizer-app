import CodeDiffDevPanel from "@/components/studio/CodeDiffDevPanel";
import { isStudioCodegenEnabled, isStudioEnabled } from "@/lib/studio/auth";

export default function StudioPage() {
  if (!isStudioEnabled()) {
    return <main className="p-6">Studio is disabled.</main>;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Studio</h1>
      {isStudioCodegenEnabled() ? (
        <section className="rounded border border-slate-300 p-4">
          <h2 className="mb-3 text-lg font-medium">Code Diff (Dev)</h2>
          <CodeDiffDevPanel />
        </section>
      ) : (
        <p className="text-sm text-slate-700">Set STUDIO_CODEGEN_ENABLED=true to enable Code Diff tooling.</p>
      )}
    </main>
  );
}
