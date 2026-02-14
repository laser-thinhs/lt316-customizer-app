import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.productProfile.upsert({
    where: { sku: "TMBLR-20OZ-STRAIGHT" },
    update: {
      name: "20oz Straight Tumbler",
      diameterMm: "76.200",
      heightMm: "212.000",
      engraveZoneWidthMm: "238.000",
      engraveZoneHeightMm: "100.000",
      seamReference: "handle-opposite-0deg",
      toolOutlineSvgPath: "/tool-outlines/tumbler-20oz-straight.svg",
      defaultSettingsProfile: {
        passCount: 1,
        hatchMm: 0.03,
        lineIntervalMm: 0.03,
        note: "Baseline template profile"
      }
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
      defaultSettingsProfile: {
        passCount: 1,
        hatchMm: 0.03,
        lineIntervalMm: 0.03,
        note: "Baseline template profile"
      }
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
