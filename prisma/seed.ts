import { PrismaClient } from "@prisma/client";
import { fingerprint } from "../src/lib/canonical";

const prisma = new PrismaClient();

const presets = [
  "Seam-Safe Left Logo",
  "Seam-Safe Right Logo",
  "Wrap Center Logo",
  "Name + Monogram Arc",
  "Dual-Side Logo + Name"
];

async function main() {
  const product = await prisma.productProfile.upsert({
    where: { sku: "TMBLR-20OZ-STRAIGHT" },
    update: {
      name: "20oz Straight Tumbler",
      diameterMm: "76.200",
      heightMm: "212.000",
      engraveZoneWidthMm: "238.000",
      engraveZoneHeightMm: "100.000",
      seamReference: "handle-opposite-0deg",
      toolOutlineSvgPath: "/tool-outlines/tumbler-20oz-straight.svg",
      defaultSettingsProfile: { passCount: 1, hatchMm: 0.03, lineIntervalMm: 0.03, note: "Baseline template profile" }
    },
    create: {
      name: "20oz Straight Tumbler",
      sku: "TMBLR-20OZ-STRAIGHT",
      diameterMm: "76.200",
      heightMm: "212.000",
      engraveZoneWidthMm: "238.000",
      engraveZoneHeightMm: "100.000",
      seamReference: "handle-opposite-0deg",
      toolOutlineSvgPath: "/tool-outlines/tumbler-20oz-straight.svg",
      defaultSettingsProfile: { passCount: 1, hatchMm: 0.03, lineIntervalMm: 0.03, note: "Baseline template profile" }
    }
  });

  await prisma.machineProfile.upsert({
    where: { id: "fiber-galvo-300-lens-default" },
    update: {},
    create: {
      id: "fiber-galvo-300-lens-default",
      name: "Fiber Galvo 300 Lens",
      laserType: "fiber-galvo",
      lens: "300mm",
      rotaryModeDefault: "axis-y",
      powerDefault: "35.000",
      speedDefault: "1200.000",
      frequencyDefault: "30.000"
    }
  });

  for (const name of presets) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const placementDocument = {
      version: 2,
      zone: { widthMm: 238, heightMm: 100 },
      objects: [
        { id: `text-${slug}`, type: "text", xMm: 10, yMm: 10, widthMm: 80, heightMm: 20, text: "Property of {{first_name | default:\"Customer\"}}", zIndex: 1 }
      ]
    };

    await prisma.template.upsert({
      where: { slug },
      update: { name, placementDocument, productProfileId: product.id, templateHash: fingerprint(placementDocument), isActive: true },
      create: {
        name,
        slug,
        description: `${name} seeded preset`,
        productProfileId: product.id,
        placementDocument,
        tags: ["seeded", "layer-2-2"],
        version: 1,
        isActive: true,
        createdBy: "seed",
        templateHash: fingerprint(placementDocument),
        tokenDefinitions: {
          create: [
            { key: "first_name", label: "First Name", required: true },
            { key: "order_number", label: "Order Number", required: false }
          ]
        }
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complete.");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
