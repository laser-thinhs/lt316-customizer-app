import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export async function listProductProfiles() {
  return prisma.productProfile.findMany({
    orderBy: { createdAt: "asc" }
  });
}

export async function getProductProfileById(id: string) {
  const item = await prisma.productProfile.findUnique({ where: { id } });
  if (!item) {
    throw new AppError("ProductProfile not found", 404, "NOT_FOUND");
  }
  return item;
}
