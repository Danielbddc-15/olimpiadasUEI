const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const router = express.Router();

// Login de usuario
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log(`Intento de login para email: "${email}"`);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log('Usuario no encontrado');
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log('Contraseña inválida');
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    console.log('Login exitoso para:', email);

    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Autenticación exitosa',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor al intentar iniciar sesión' });
  }
});

// Seed admin user (solo para inicializar o en desarrollo)
router.post('/seed', async (req, res) => {
  try {
    const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@uei.edu.ec' } });
    if (existingAdmin) {
      return res.json({ message: 'El administrador ya existe' });
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    const newAdmin = await prisma.user.create({
      data: {
        email: 'admin@uei.edu.ec',
        password: hashedPassword,
        role: 'ADMIN'
      }
    });

    res.json({ message: 'Administrador creado', user: newAdmin.email });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear administrador', error: error.message });
  }
});

module.exports = router;
