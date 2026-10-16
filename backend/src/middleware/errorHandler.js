// 404 para rutas inexistentes
function notFound(req, res) {
  return res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Manejador de errores centralizado.
 * Traduce errores de Mongoose/Express a respuestas JSON legibles.
 */
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Error interno del servidor';
  let errors = null;

  // Errores de validación de Mongoose
  if (err.name === 'ValidationError') {
    status = 400;
    errors = Object.values(err.errors).map((e) => e.message);
    message = 'Datos inválidos. Verifique los campos enviados.';
  }

  // Índice único duplicado (email / nombre repetido)
  if (err.code === 11000) {
    status = 400;
    const field = Object.keys(err.keyPattern || {})[0];
    message = field ? `El valor para "${field}" ya está en uso` : 'Valor duplicado';
  }

  // Cast de ObjectId inválido
  if (err.name === 'CastError') {
    status = 400;
    message = 'Identificador no válido';
  }

  // Token inválido
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Sesión inválida o expirada';
  }

  return res.status(status).json({ success: false, message, errors });
}

module.exports = { notFound, errorHandler };