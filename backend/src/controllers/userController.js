const User = require('../models/User');
const Recipe = require('../models/Recipe');
const Group = require('../models/Group');

/**
 * GET /api/users/me
 * Devuelve el perfil del usuario autenticado.
 */
exports.getMe = async (req, res, next) => {
  try {
    return res.json({ success: true, data: req.user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/me
 * Edita el perfil: nombre, email, avatar y/o contraseña.
 */
exports.updateMe = async (req, res, next) => {
  try {
    const { name, email, password, avatar } = req.body;
    const user = req.user;

    if (name !== undefined) user.name = name;

    // Cambio de email con verificación de unicidad (activos, sin incluirse a sí mismo)
    if (email !== undefined && email !== user.email) {
      const normalized = email.toLowerCase().trim();
      const exists = await User.findOne({
        email: normalized,
        deletedAt: null,
        _id: { $ne: user._id },
      });
      if (exists) {
        return res.status(400).json({ success: false, message: 'El email ya está en uso por otro usuario' });
      }
      user.email = normalized;
    }

    if (avatar !== undefined) user.avatar = avatar;

    // Si se envía contraseña, el pre-save se encarga de hashearla
    if (password) user.password = password;

    await user.save();
    return res.json({ success: true, data: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/me
 * Borrado lógico de la cuenta. Adicionalmente:
 *   - Borra lógicamente las recetas del usuario.
 *   - Borra lógicamente los grupos del usuario.
 */
exports.deleteMe = async (req, res, next) => {
  try {
    const user = req.user;
    const now = new Date();

    user.deletedAt = now;
    await user.save();

    // Cascada: recetas y grupos del usuario pasan a borrado lógico
    await Recipe.updateMany({ owner: user._id, deletedAt: null }, { $set: { deletedAt: now } });
    await Group.updateMany({ owner: user._id, deletedAt: null }, { $set: { deletedAt: now } });

    return res.json({ success: true, message: 'Cuenta eliminada correctamente' });
  } catch (err) {
    next(err);
  }
};