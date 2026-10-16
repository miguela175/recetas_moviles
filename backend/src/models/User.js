const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Modelo de Usuario.
 *
 * Borrado lógico: el campo `deletedAt` indica si la cuenta fue "eliminada".
 * Nunca se borra físicamente el documento; al marcar `deletedAt` la cuenta
 * deja de poder iniciar sesión y de aparecer en las consultas.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      maxlength: [60, 'El nombre no puede superar 60 caracteres'],
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[\w.+-]+@[\w-]+\.[\w.-]+$/, 'El email no tiene un formato válido'],
    },
    // select:false para no devolver la contraseña en consultas normales
    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
      minlength: [6, 'La contraseña debe tener al menos 6 caracteres'],
      select: false,
    },
    avatar: {
      type: String,
      default: '',
    },
    // Borrado lógico: null = activo, Date = eliminado
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Hashea la contraseña automáticamente antes de guardar/cambiar
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compara una contraseña en texto plano con el hash guardado
userSchema.methods.matchPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

// Devuelve una versión "segura" del usuario sin datos sensibles
userSchema.methods.toSafeJSON = function () {
  const { _id, name, email, avatar, createdAt, updatedAt } = this;
  return { _id, name, email, avatar, createdAt, updatedAt };
};

module.exports = mongoose.model('User', userSchema);