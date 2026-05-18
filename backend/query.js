require('dotenv').config();
const prisma = require('./src/prisma');
prisma.user.findMany().then(users => {
  console.log(users);
  prisma.$disconnect();
});
