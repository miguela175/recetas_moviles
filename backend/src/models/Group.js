const mongoose = require('mongoose');

/**
 * Modelo de Grupo.
 *
 * Borrado lógico: `deletedAt` marca el grupo como eliminado.
 *
 * Un grupo:
 *   - Pertenece a un único usuario (`owner`).
 *   - Contiene varias recetas (`recipes`). Una misma receta puede estar
 *     simultáneamente en varios grupos.
 *
 * Regla de borrado:
 *   - Eliminar un grupo borra (lógicamente) las recetas PROPIAS del usuario
 *     contenidas en él y desvincula el resto.
 *   - Quitar una receta de un grupo NUNCA borra la receta: solo la desvincula.
 */
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del grupo es obligatorio'],
      trim: true,
      maxlength: [80, 'El nombre no puede superar 80 caracteres'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [400, 'La descripción no puede superar 400 caracteres'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe',
      },
    ],
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Índice para comprobar la unicidad del nombre por usuario
groupSchema.index({ name: 1, owner: 1 });

module.exports = mongoose.model('Group', groupSchema);