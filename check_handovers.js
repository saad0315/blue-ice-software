
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const handovers = await prisma.cashHandover.findMany({
    take: 5,
    orderBy: {
      date: 'desc'
    },
    select: {
      id: true,
      date: true,
      status: true,
      actualCash: true,
      createdAt: true
    }
  });

  console.log('Recent Handovers:', JSON.stringify(handovers, null, 2));
  console.log('Current Server Date (new Date()):', new Date().toISOString());
  console.log('Current Server Local String:', new Date().toString());
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
