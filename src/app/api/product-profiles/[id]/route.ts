import { fail, ok } from "@/lib/response";
import { getProductProfileById } from "@/services/product-profile.service";
import { AppError } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

const devFallbackProfiles = [
  {
    id: "dev-tumbler-20oz",
    name: "20oz Straight Tumbler (Dev Fallback)",
    sku: "TMBLR-20OZ-STRAIGHT"
  }
];

function isDatabaseUnavailable(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("can't reach database server") || message.includes("p1001") || message.includes("econnrefused");
}

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await getProductProfileById(id);
    return ok(data);
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && isDatabaseUnavailable(error)) {
      const { id } = await params;
      const fallback = devFallbackProfiles.find((entry) => entry.id === id);
      if (fallback) return ok(fallback);
      return fail(new AppError("ProductProfile not found", 404, "NOT_FOUND"));
    }
    return fail(error);
  }
}
