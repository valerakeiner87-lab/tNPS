const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const users = await prisma.user.count();
    console.log('User count:', users);
    const u = await prisma.user.findFirst({ select: { id: true, username: true, fechaNacimiento: true, role: true } });
    console.log('First user:', u);
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
