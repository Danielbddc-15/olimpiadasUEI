const express = require('express');
const prisma = require('../prisma');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Middleware de autenticación global para estas rutas
router.use(authMiddleware);

// --- USUARIOS ---
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, nombre: true, email: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/users', async (req, res) => {
  const bcrypt = require('bcryptjs');
  try {
    const { email, password, role, nombre } = req.body;
    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    const user = await prisma.user.create({
      data: {
        nombre,
        email,
        password: hashedPassword,
        role: role.toUpperCase(),
      }
    });
    res.json({ id: user.id, email: user.email, role: user.role, nombre });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.role) data.role = data.role.toUpperCase();
    delete data.id; // Prisma no permite actualizar el ID
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CATEGORIAS ---
router.get('/categorias', async (req, res) => {
  const { disciplina } = req.query;
  try {
    const categorias = await prisma.categoria.findMany({
      where: disciplina ? { disciplina } : undefined
    });
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/categorias', async (req, res) => {
  try {
    const categoria = await prisma.categoria.create({ data: req.body });
    res.json(categoria);
  } catch (error) {
    console.error("Error creating categoria:", error, "Body:", req.body);
    res.status(500).json({ error: error.message });
  }
});

router.put('/categorias/:id', async (req, res) => {
  try {
    const categoria = await prisma.categoria.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(categoria);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/categorias/:id', async (req, res) => {
  try {
    await prisma.categoria.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- NIVELES EDUCACIONALES ---
router.get('/niveles', async (req, res) => {
  const { disciplina } = req.query;
  try {
    const niveles = await prisma.nivelEducacional.findMany({
      where: disciplina ? { disciplina } : undefined
    });
    res.json(niveles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/niveles', async (req, res) => {
  try {
    const nivel = await prisma.nivelEducacional.create({ data: req.body });
    res.json(nivel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/niveles/:id', async (req, res) => {
  try {
    const nivel = await prisma.nivelEducacional.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(nivel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/niveles/:id', async (req, res) => {
  try {
    await prisma.nivelEducacional.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- GRUPOS ---
router.get('/grupos', async (req, res) => {
  const { disciplina, categoria, nivelEducacional, genero } = req.query;
  
  const where = {};
  if (disciplina) where.disciplina = disciplina;
  if (categoria) where.categoria = categoria;
  if (nivelEducacional) where.nivelEducacional = nivelEducacional;
  if (genero) where.genero = genero;

  try {
    const grupos = await prisma.grupo.findMany({ where });
    res.json(grupos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/grupos', async (req, res) => {
  const { nombre, disciplina, categoria, nivelEducacional, genero } = req.body;
  const normalizedNombre = nombre.trim();
  
  try {
    // Verificar si ya existe un grupo idéntico (insensible a mayúsculas y espacios)
    const existingGrupo = await prisma.grupo.findFirst({
      where: {
        nombre: {
          equals: normalizedNombre,
          mode: 'insensitive'
        },
        disciplina,
        categoria,
        nivelEducacional,
        genero
      }
    });

    if (existingGrupo) {
      return res.json(existingGrupo);
    }

    const grupo = await prisma.grupo.create({ 
      data: { 
        ...req.body, 
        nombre: normalizedNombre 
      } 
    });
    res.json(grupo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/grupos/:id', async (req, res) => {
  try {
    const grupo = await prisma.grupo.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(grupo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/grupos/:id', async (req, res) => {
  try {
    await prisma.grupo.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- EQUIPOS ---
router.get('/equipos', async (req, res) => {
  const { disciplina } = req.query;
  try {
    const equipos = await prisma.equipo.findMany({
      where: disciplina ? { disciplina } : undefined
    });
    res.json(equipos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/equipos', async (req, res) => {
  try {
    const equipo = await prisma.equipo.create({ data: req.body });
    res.json(equipo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/equipos/:id', async (req, res) => {
  try {
    const equipo = await prisma.equipo.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(equipo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/equipos/:id', async (req, res) => {
  try {
    await prisma.equipo.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- JUGADORES ---
router.get('/jugadores', async (req, res) => {
  const { disciplina, equipoId, genero, curso, paralelo, categoria } = req.query;
  
  const where = {};
  if (disciplina) where.disciplina = disciplina;
  if (equipoId) where.equipoId = equipoId;
  if (genero) where.genero = genero;
  if (curso) where.curso = curso;
  if (paralelo) where.paralelo = paralelo;
  if (categoria) where.categoria = categoria;

  try {
    const jugadores = await prisma.jugador.findMany({ where });
    res.json(jugadores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/jugadores', async (req, res) => {
  try {
    const jugador = await prisma.jugador.create({ data: req.body });
    res.json(jugador);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/jugadores/:id', async (req, res) => {
  try {
    const jugador = await prisma.jugador.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(jugador);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/jugadores/:id', async (req, res) => {
  try {
    await prisma.jugador.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- MATCHES ---
router.get('/matches', async (req, res) => {
  const { disciplina } = req.query;
  try {
    const matches = await prisma.match.findMany({
      where: disciplina ? { disciplina } : undefined,
      include: {
        equipoA: true,
        equipoB: true
      }
    });
    // Transformar para que el frontend reciba algo similar a lo que obtenía de Firebase
    const transformedMatches = matches.map(m => ({
      ...m,
      // Si el equipo existe en DB, usarlo; si no, Firebase guardaba un objeto, lo simulamos
      equipoA: m.equipoA || m.equipoA, 
      equipoB: m.equipoB || m.equipoB
    }));
    res.json(transformedMatches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/matches', async (req, res) => {
  try {
    // Si viene equipoA o equipoB como objeto (formato antiguo firebase), lo omitimos temporalmente
    // idealmente el frontend ahora enviará equipoAId y equipoBId.
    const { equipoA, equipoB, ...data } = req.body;
    
    // Si el frontend envía objetos, los intentamos vincular si sabemos el ID.
    // Esto es parte de la adaptación.
    if (equipoA && equipoA.id) data.equipoAId = equipoA.id;
    if (equipoB && equipoB.id) data.equipoBId = equipoB.id;

    const match = await prisma.match.create({ data });
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/matches/:id', async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: req.params.id },
      include: {
        equipoA: true,
        equipoB: true
      }
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/matches/:id', async (req, res) => {
  try {
    const { equipoA, equipoB, ...data } = req.body;
    
    const match = await prisma.match.update({
      where: { id: req.params.id },
      data
    });
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/matches/:id', async (req, res) => {
  try {
    await prisma.match.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
