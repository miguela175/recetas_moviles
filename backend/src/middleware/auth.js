const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware de autenticación (JWT Bearer).
 *
 * Verifica el token del header Authorization, carga el usuario activo
 * (que no tenga borrado lógico) y lo adjunta en `req.user`.
 */
module.exports = async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No autorizado: token faltante' });
    }

    const token = header.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'recetas_dev_secret';
    const decoded = jwt.verify(token, secret);

    // Busca el usuario; si la cuenta tiene borrado lógico no puede operar
    const user = await User.findById(decoded.id);
    if (!user || user.deletedAt) {
      return res.status(401).json({ success: false, message: 'La cuenta no existe o fue desactivada' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Sesión inválida o expirada' });
  }
};