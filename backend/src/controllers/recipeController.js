const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');
const Group = require('../models/Group');

/** Escapa caracteres especiales de regex para búsquedas de texto */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Filtro estándar de "no borrado" (borrado lógico) */
function activeFilter(extra = {}) {
  return { deletedAt: null, ...extra };
}

/** Normaliza ingredientes y pasos recibidos del cliente */
function normalizeBody(body) {
  const ingredients = Array.isArray(body.ingredients)
    ? body.ingredients
        .map((i) => ({
          name: (i.name || '').trim(),
          quantity: (i.quantity || '').trim(),
          unit: (i.unit || '').trim(),
        }))
        .filter((i) => i.name)
    : [];

  const steps = Array.isArray(body.steps)
    ? body.steps.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
    : [];

  return {
    title: (body.title || '').trim(),
    description: (body.description || '').trim(),
    category: (body.category || '').trim(),
    difficulty: body.difficulty || 'Fácil',
    timeMinutes: Number(body.timeMinutes) || 30,
    servings: Number(body.servings) || 1,
    ingredients,
    steps,
  };
}

/**
 * GET /api/recipes
 * Lista de recetas activas ordenadas alfabéticamente (locale ES).
 * Query params:
 *   mine=true  -> solo recetas del usuario autenticado (personales)
 *   group=<id> -> recetas de un grupo concreto
 *   q=<texto>  -> búsqueda por título
 */
exports.getAll = async (req, res, next) => {
  try {
    const { mine, group, q } = req.query;
    const filter = activeFilter();

    if (mine === 'true') filter.owner = req.user._id;
    if (group) filter.groups = group;
    if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

    const recipes = await Recipe.find(filter)
      .collation({ locale: 'es', strength: 2 })
      .sort({ title: 1 }) // orden alfabético
      .populate('owner', 'name')
      .populate('groups', 'name');

    return res.json({ success: true, data: recipes });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/recipes/:id
 * Detalle de una receta activa con sus grupos poblados.
 */
exports.getOne = async (req, res, next) => {
  try {
    const recipe = await Recipe.findOne(activeFilter({ _id: req.params.id }))
      .populate('owner', 'name')
      .populate('groups', 'name');
    if (!recipe) return res.status(404).json({ success: false, message: 'Receta no encontrada' });
    return res.json({ success: true, data: recipe });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/recipes
 * Crea una receta. Verifica que no exista otra receta con el mismo
 * título para el mismo usuario (recetas activas).
 */
exports.create = async (req, res, next) => {
  try {
    const data = normalizeBody(req.body);

    if (!data.title) {
      return res.status(400).json({ success: false, message: 'El título de la receta es obligatorio' });
    }

    // Unicidad por título (case-insensitive) entre recetas activas del usuario
    const duplicate = await Recipe.findOne(
      activeFilter({ owner: req.user._id, title: { $regex: `^${escapeRegex(data.title)}$`, $options: 'i' } })
    );
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Ya tienes una receta con ese mismo título' });
    }

    // Valida los grupos indicados (deben ser del usuario y estar activos)
    const groupIds = Array.isArray(req.body.groups) ? [...new Set(req.body.groups)] : [];
    const validGroups = await Group.find({
      _id: { $in: groupIds },
      owner: req.user._id,
      deletedAt: null,
    });
    const validGroupIds = validGroups.map((g) => g._id);

    const recipe = await Recipe.create({ ...data, owner: req.user._id, groups: validGroupIds });

    // Enlaza la receta en cada grupo
    if (validGroupIds.length) {
      await Group.updateMany({ _id: { $in: validGroupIds } }, { $addToSet: { recipes: recipe._id } });
    }

    const populated = await Recipe.findById(recipe._id).populate('groups', 'name');
    return res.status(201).json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/recipes/:id
 * Edita una receta (solo el autor). Con misma verificación de duplicados.
 */
exports.update = async (req, res, next) => {
  try {
    const recipe = await Recipe.findOne(activeFilter({ _id: req.params.id }));
    if (!recipe) return res.status(404).json({ success: false, message: 'Receta no encontrada' });

    // Solo el autor puede modificar la receta
    if (recipe.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para editar esta receta' });
    }

    const data = normalizeBody(req.body);

    if (!data.title) {
      return res.status(400).json({ success: false, message: 'El título de la receta es obligatorio' });
    }

    // Duplicados excluyendo la propia receta
    const duplicate = await Recipe.findOne(
      activeFilter({
        owner: req.user._id,
        _id: { $ne: recipe._id },
        title: { $regex: `^${escapeRegex(data.title)}$`, $options: 'i' },
      })
    );
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Ya tienes una receta con ese mismo título' });
    }

    Object.assign(recipe, data);

    // Sincroniza pertenencia a grupos si se envió el campo
    if (req.body.groups !== undefined) {
      const groupIds = [...new Set(Array.isArray(req.body.groups) ? req.body.groups : [])];
      const validGroups = await Group.find({
        _id: { $in: groupIds },
        owner: req.user._id,
        deletedAt: null,
      });
      recipe.groups = validGroups.map((g) => g._id);
    }

    await recipe.save();

    // Actualiza la referencia inversa en los grupos
    await Group.updateMany({ recipes: recipe._id }, { $pull: { recipes: recipe._id } });
    if (recipe.groups.length) {
      await Group.updateMany({ _id: { $in: recipe.groups } }, { $addToSet: { recipes: recipe._id } });
    }

    const populated = await Recipe.findById(recipe._id).populate('groups', 'name');
    return res.json({ success: true, data: populated });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/recipes/:id
 * Borrado lógico de la receta (solo el autor).
 * Al borrarla, la receta "queda fuera" de todos sus grupos (se desvincula).
 */
exports.remove = async (req, res, next) => {
  try {
    const recipe = await Recipe.findOne(activeFilter({ _id: req.params.id }));
    if (!recipe) return res.status(404).json({ success: false, message: 'Receta no encontrada' });

    if (recipe.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar esta receta' });
    }

    recipe.deletedAt = mongoose.now();
    await recipe.save();

    // Desvincula la receta de todos los grupos (sin borrarlos)
    await Group.updateMany({ recipes: recipe._id }, { $pull: { recipes: recipe._id } });

    return res.json({ success: true, message: 'Receta eliminada correctamente' });
  } catch (err) {
    next(err);
  }
};