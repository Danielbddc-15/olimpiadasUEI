require('dotenv').config();
const prisma = require('./src/prisma');

prisma.categoria.create({ 
  data: { 
    nombre: 'TEST_CAT', 
    disciplina: 'TEST', 
    genero: 'TEST', 
    nivelEducacional: 'TEST' 
  } 
}).then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
