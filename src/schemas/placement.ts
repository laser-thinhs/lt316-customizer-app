import { z } from "zod";

export const placementSchema = z.object({
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  offsetXMm: z.number(),
  offsetYMm: z.number(),
  rotationDeg: z.number(),
  anchor: z.enum(["center", "top-left", "top-right", "bottom-left", "bottom-right"])
});

export type PlacementInput = z.infer<typeof placementSchema>;
