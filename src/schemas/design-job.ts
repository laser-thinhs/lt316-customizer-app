import { z } from "zod";
import { placementSchema } from "./placement";

export const createDesignJobSchema = z.object({
  orderRef: z.string().trim().min(1).max(100).optional(),
  productProfileId: z.string().min(1),
  machineProfileId: z.string().min(1),
  placementJson: placementSchema,
  previewImagePath: z.string().optional()
});

export const updatePlacementSchema = z.object({
  placementJson: placementSchema
});

export type CreateDesignJobInput = z.infer<typeof createDesignJobSchema>;
export type UpdatePlacementInput = z.infer<typeof updatePlacementSchema>;
