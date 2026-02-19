import { fail, ok } from "@/lib/response";
import { listProductProfiles } from "@/services/product-profile.service";

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

export async function GET() {
  try {
    const data = await listProductProfiles();
    return ok(data);
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && isDatabaseUnavailable(error)) {
      return ok(devFallbackProfiles);
    }
    return fail(error);
  }
}
