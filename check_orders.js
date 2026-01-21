
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      paymentMethod: 'CASH',
    },
    take: 5,
    orderBy: {
      updatedAt: 'desc'
    },
    select: {
      id: true,
      readableId: true,
      status: true,
      paymentMethod: true,
      deliveredAt: true,
      scheduledDate: true,
      cashCollected: true
    }
  });

  console.log('Recent Cash Orders:', JSON.stringify(orders, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
