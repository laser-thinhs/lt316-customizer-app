import { notFound } from "next/navigation";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  if (process.env.STUDIO_ENABLED !== "true") {
    notFound();
  }

  return children;
}
