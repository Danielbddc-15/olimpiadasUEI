const prisma = require('../src/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  const adminEmail = 'admin@uei.edu.ec';
  const adminPassword = await bcrypt.hash('admin123', 10);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: adminPassword,
        role: 'ADMIN'
      }
    });
    console.log('Admin user created: admin@uei.edu.ec / admin123');
  } else {
    console.log('Admin user already exists');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
