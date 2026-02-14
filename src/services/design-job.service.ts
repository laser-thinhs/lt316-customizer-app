import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { createDesignJobSchema, CreateDesignJobInput } from "@/schemas/design-job";

export async function createDesignJob(rawInput: unknown) {
  const input: CreateDesignJobInput = createDesignJobSchema.parse(rawInput);

  const [product, machine] = await Promise.all([
    prisma.productProfile.findUnique({ where: { id: input.productProfileId } }),
    prisma.machineProfile.findUnique({ where: { id: input.machineProfileId } })
  ]);

  if (!product) throw new AppError("Invalid productProfileId", 400, "INVALID_PRODUCT_PROFILE");
  if (!machine) throw new AppError("Invalid machineProfileId", 400, "INVALID_MACHINE_PROFILE");

  const job = await prisma.designJob.create({
    data: {
      orderRef: input.orderRef,
      productProfileId: input.productProfileId,
      machineProfileId: input.machineProfileId,
      placementJson: input.placementJson,
      previewImagePath: input.previewImagePath,
      status: "draft"
    },
    include: {
      productProfile: true,
      machineProfile: true
    }
  });

  return job;
}

export async function getDesignJobById(id: string) {
  const job = await prisma.designJob.findUnique({
    where: { id },
    include: {
      productProfile: true,
      machineProfile: true,
      assets: true
    }
  });

  if (!job) {
    throw new AppError("DesignJob not found", 404, "NOT_FOUND");
  }

  return job;
}
