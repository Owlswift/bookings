import { PrismaClient } from '@prisma/client';

module.exports = async () => {
  const prisma = new PrismaClient();
  await prisma.$connect();
  
  // Clean database
  await prisma.booking.deleteMany({});
  await prisma.user.deleteMany({});
  
  await prisma.$disconnect();
};