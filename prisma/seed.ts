import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.productTemplate.upsert({
    where: { name: '20oz tumbler' },
    update: {},
    create: {
      name: '20oz tumbler',
      diameterMm: 72,
      heightMm: 220,
      engravingAreaWidthMm: 210,
      engravingAreaHeightMm: 95,
      lightburnDefaults: {
        speedMmPerSec: 250,
        powerPercent: 55,
        passes: 1
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
