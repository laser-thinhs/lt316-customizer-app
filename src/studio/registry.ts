import { z } from "zod";
import {
  cylinderBlockPropsSchema,
  imageBlockPropsSchema,
  StudioBlockType,
  textBlockPropsSchema
} from "@/studio/types";

export type StudioBlockRegistryItem = {
  label: string;
  propsSchema: z.ZodTypeAny;
  defaultProps: Record<string, unknown>;
};

export const studioBlockRegistry: Record<StudioBlockType, StudioBlockRegistryItem> = {
  text: {
    label: "Text",
    propsSchema: textBlockPropsSchema,
    defaultProps: {
      text: "New text block",
      align: "left"
    }
  },
  image: {
    label: "Image",
    propsSchema: imageBlockPropsSchema,
    defaultProps: {
      src: "",
      alt: ""
    }
  },
  cylinder: {
    label: "3D Model (Cylinder)",
    propsSchema: cylinderBlockPropsSchema,
    defaultProps: {
      label: "Cylinder",
      diameterMm: 50,
      heightMm: 120
    }
  }
};
