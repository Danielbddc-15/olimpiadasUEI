const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // Permitir accesos GET públicos (sin token) para los datos del torneo
  const publicGetPaths = ['/categorias', '/niveles', '/grupos', '/equipos', '/matches'];
  if (req.method === 'GET' && publicGetPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No se proporcionó un token de autenticación' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    return res.status(403).json({ message: 'Acceso denegado: Se requieren permisos de administrador' });
  }
};

module.exports = { authMiddleware, adminMiddleware };
