const jwt = require('jsonwebtoken');
const User = require('../models/User');

/** Genera un token JWT para el usuario dado */
function generateToken(user) {
  const secret = process.env.JWT_SECRET || 'recetas_dev_secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id: user._id }, secret, { expiresIn });
}

/**
 * POST /api/auth/register
 * Registro de usuario. Si el email ya existía pero con borrado lógico,
 * la cuenta se "reactiva" con los datos nuevos.
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nombre, email y contraseña son obligatorios' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Busca por email sin importar si es activo o borrado
    let user = await User.findOne({ email: normalizedEmail });

    if (user && !user.deletedAt) {
      return res.status(400).json({ success: false, message: 'El email ya está registrado' });
    }

    if (user && user.deletedAt) {
      // Reactivación de una cuenta eliminada lógicamente
      user.name = name;
      user.password = password; // pre-save lo hashea
      user.deletedAt = null;
      await user.save();
    } else {
      user = await User.create({ name, email: normalizedEmail, password });
    }

    return res.status(201).json({
      success: true,
      message: 'Registro completado',
      data: { token: generateToken(user), user: user.toSafeJSON() },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Inicio de sesión. Rechaza cuentas con borrado lógico.
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y contraseña son obligatorios' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user || user.deletedAt) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const ok = await user.matchPassword(password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    return res.json({
      success: true,
      data: { token: generateToken(user), user: user.toSafeJSON() },
    });
  } catch (err) {
    next(err);
  }
};