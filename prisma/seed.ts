import { faker } from '@faker-js/faker';
import {
  CustomerType,
  OrderStatus,
  PaymentMethod,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CONFIG = {
  CUSTOMERS_COUNT: 100,
  PAST_DAYS: 10,
};

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('🌱 Starting seed...');

  // ================= CLEANUP =================
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.driverProfile.deleteMany();
  await prisma.route.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // ================= USERS =================
  const password = await hashPassword('password123');

  await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'admin@blueice.com',
      phoneNumber: '03000000000',
      password,
      role: UserRole.SUPER_ADMIN,
    },
  });

  // ================= DRIVERS (5 ONLY) =================
  const drivers = [];

  for (let i = 0; i < 5; i++) {
    const driver = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: `driver${i}@blueice.com`,
        phoneNumber: `030000000${i + 1}`,
        password,
        role: UserRole.DRIVER,
        driverProfile: {
          create: {
            vehicleNo: faker.vehicle.vrm(),
            licenseNo: faker.string.alphanumeric(8).toUpperCase(),
            isOnDuty: true,
          },
        },
      },
      include: { driverProfile: true },
    });
    drivers.push(driver);
  }

  // ================= PRODUCTS =================
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: '19L Water',
        sku: 'W-19L',
        basePrice: 200,
        isReturnable: true,
        stockFilled: 500,
        stockEmpty: 100,
      },
    }),
    prisma.product.create({
      data: {
        name: '12L Water',
        sku: 'W-12L',
        basePrice: 150,
        isReturnable: true,
        stockFilled: 300,
        stockEmpty: 50,
      },
    }),
  ]);

  // ================= ROUTES =================
  const routeNames = ['DHA', 'Clifton', 'Gulshan', 'Nazimabad'];

  const routes = [];
  for (const name of routeNames) {
    routes.push(
      await prisma.route.create({
        data: {
          name,
          description: `Route for ${name}`,
          defaultDriverId:
            drivers[Math.floor(Math.random() * drivers.length)].driverProfile
              ?.id,
        },
      }),
    );
  }

  // ================= CUSTOMERS (100 ONLY) =================
  const customers = [];

  for (let i = 0; i < CONFIG.CUSTOMERS_COUNT; i++) {
    const route = faker.helpers.arrayElement(routes);

    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        phoneNumber: `03${faker.string.numeric(9)}`,
        password,
        role: UserRole.CUSTOMER,
        customerProfile: {
          create: {
            manualCode: `CUST-${i + 1}`,
            type: faker.helpers.arrayElement(Object.values(CustomerType)),
            address: faker.location.streetAddress(),
            area: route.name,
            routeId: route.id,
            creditLimit: 5000,
            cashBalance: 0,
          },
        },
      },
      include: { customerProfile: true },
    });

    if (user.customerProfile) customers.push(user.customerProfile);
  }

  // ================= ORDERS (LAST 10 DAYS) =================
  /*
  const today = new Date();

  for (let d = CONFIG.PAST_DAYS; d >= 1; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);

    for (let i = 0; i < 10; i++) {
      const customer = faker.helpers.arrayElement(customers);
      const driver = faker.helpers.arrayElement(drivers);
      const product = products[0];
      const qty = faker.number.int({ min: 1, max: 3 });

      await prisma.order.create({
        data: {
          customerId: customer.id,
          driverId: driver.driverProfile?.id,
          scheduledDate: date,
          deliveredAt: date,
          status: OrderStatus.COMPLETED,
          totalAmount: qty * Number(product.basePrice),
          paymentMethod: PaymentMethod.CASH,
          cashCollected: qty * Number(product.basePrice),
          orderItems: {
            create: {
              productId: product.id,
              quantity: qty,
              priceAtTime: product.basePrice,
              filledGiven: qty,
              emptyTaken: qty,
            },
          },
        },
      });
    }
  }
  */

  console.log('✅ Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
