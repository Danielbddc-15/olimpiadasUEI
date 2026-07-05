require('dotenv').config();
const prisma = require('./src/prisma');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('Obteniendo usuarios de la base de datos...');
  const users = await prisma.user.findMany();
  console.log(`Se encontraron ${users.length} usuarios.`);

  let updatedCount = 0;

  for (const user of users) {
    // Las contraseñas de bcrypt típicamente empiezan con $2a$, $2b$ o $2y$ y tienen una longitud de 60 caracteres
    const isHashed = (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) && user.password.length === 60;
    if (!isHashed) {
      console.log(`Hasheando contraseña en texto plano para el usuario: ${user.email}`);
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      updatedCount++;
    } else {
      console.log(`El usuario ${user.email} ya tiene una contraseña hasheada.`);
    }
  }

  console.log(`Proceso terminado. Se actualizaron ${updatedCount} usuarios.`);
}

main()
  .catch(e => {
    console.error('Error al actualizar las contraseñas:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
