const mongoose = require('mongoose');

/**
 * Modelo de Receta.
 *
 * Borrado lógico: `deletedAt` marca la receta como eliminada sin borrarla.
 *
 * Relaciones:
 *   - owner: usuario que creó la receta (autor).
 *   - groups: lista de grupos (ObjectId) a los que pertenece la receta.
 *             Una receta puede estar en MÚLTIPLES grupos.
 */
const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'El ingrediente necesita nombre'], trim: true },
    quantity: { type: String, default: '', trim: true },
    unit: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'El título de la receta es obligatorio'],
      trim: true,
      maxlength: [100, 'El título no puede superar 100 caracteres'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [1000, 'La descripción no puede superar 1000 caracteres'],
    },
    category: {
      type: String,
      default: '',
      trim: true,
      maxlength: 60,
    },
    difficulty: {
      type: String,
      enum: ['Fácil', 'Intermedia', 'Difícil'],
      default: 'Fácil',
    },
    timeMinutes: {
      type: Number,
      default: 30,
      min: [1, 'El tiempo debe ser al menos 1 minuto'],
      max: [1440, 'El tiempo no puede superar 24 horas'],
    },
    servings: {
      type: Number,
      default: 1,
      min: [1, 'Las porciones deben ser al menos 1'],
    },
    ingredients: {
      type: [ingredientSchema],
      default: [],
    },
    steps: {
      type: [String],
      default: [],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Una receta puede estar en varios grupos
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
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

// Índice para la comprobación de recetas duplicadas por usuario
recipeSchema.index({ title: 1, owner: 1 });

module.exports = mongoose.model('Recipe', recipeSchema);