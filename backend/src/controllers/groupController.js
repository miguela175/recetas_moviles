const mongoose = require('mongoose');
const Group = require('../models/Group');
const Recipe = require('../models/Recipe');

/** Filtro estándar de "no borrado" */
function activeFilter(extra = {}) {
  return { deletedAt: null, ...extra };
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/groups
 * Grupos del usuario autenticado, ordenados alfabéticamente.
 */
exports.getAll = async (req, res, next) => {
  try {
    const groups = await Group.find(activeFilter({ owner: req.user._id }))
      .collation({ locale: 'es', strength: 2 })
      .sort({ name: 1 }) // orden alfabético
      .populate('recipes', 'title');

    return res.json({ success: true, data: groups });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/groups/:id
 * Detalle del grupo con sus recetas ordenadas alfabéticamente.
 */
exports.getOne = async (req, res, next) => {
  try {
    const group = await Group.findOne(activeFilter({ _id: req.params.id, owner: req.user._id }));

    if (!group) {
      return res.status(404).json({ success: false, message: 'Grupo no encontrado' });
    }

    // Recetas activas del grupo, ordenadas por título
    const recipes = await Recipe.find(activeFilter({ _id: { $in: group.recipes } }))
      .collation({ locale: 'es', strength: 2 })
      .sort({ title: 1 })
      .populate('owner', 'name')
      .populate('groups', 'name');

    return res.json({ success: true, data: { ...group.toObject(), recipes } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/groups
 * Crea un grupo. Un usuario no puede repetir el nombre de un grupo activo.
 */
exports.create = async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'El nombre del grupo es obligatorio' });

    const duplicate = await Group.findOne(
      activeFilter({ owner: req.user._id, name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } })
    );
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Ya tienes un grupo con ese mismo nombre' });
    }

    const group = await Group.create({
      name,
      description: (req.body.description || '').trim(),
      owner: req.user._id,
      recipes: [],
    });

    return res.status(201).json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/groups/:id
 * Edita nombre y/o descripción del grupo.
 */
exports.update = async (req, res, next) => {
  try {
    const group = await Group.findOne(activeFilter({ _id: req.params.id, owner: req.user._id }));
    if (!group) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });

    const name = (req.body.name || group.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'El nombre del grupo es obligatorio' });

    const duplicate = await Group.findOne(
      activeFilter({
        owner: req.user._id,
        _id: { $ne: group._id },
        name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
      })
    );
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Ya tienes un grupo con ese mismo nombre' });
    }

    group.name = name;
    if (req.body.description !== undefined) group.description = (req.body.description || '').trim();
    await group.save();

    return res.json({ success: true, data: group });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/groups/:id
 * Elimina un grupo (borrado lógico) con cascada controlada:
 *   - Las recetas PROPIAS del usuario dentro del grupo se borran lógicamente.
 *   - El resto de recetas del grupo simplemente se desvinculan.
 *   - El grupo se desvincula de todas las recetas y se marca como borrado.
 * Devuelve un resumen con la cantidad de recetas afectadas.
 */
exports.remove = async (req, res, next) => {
  try {
    const group = await Group.findOne(activeFilter({ _id: req.params.id, owner: req.user._id }));
    if (!group) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });

    const recipesInGroup = group.recipes.length;

    // 1. Recetas propias del usuario en el grupo: borrado lógico (cascada)
    const ownedRecipes = await Recipe.find({
      _id: { $in: group.recipes },
      owner: req.user._id,
      deletedAt: null,
    });
    const ownedIds = ownedRecipes.map((r) => r._id);
    const now = mongoose.now();
    await Recipe.updateMany({ _id: { $in: ownedIds } }, { $set: { deletedAt: now } });

    // 2. Desvincula el grupo de TODAS sus recetas (las de otros usuarios solo se desvinculan)
    await Recipe.updateMany({ groups: group._id }, { $pull: { groups: group._id } });

    // 3. Borrado lógico del grupo
    group.deletedAt = now;
    await group.save();

    const detachedRecipes = recipesInGroup - ownedIds.length;

    return res.json({
      success: true,
      message: `Grupo eliminado. ${ownedIds.length} receta(s) propias eliminada(s) y ${detachedRecipes} receta(s) desvinculada(s).`,
      data: { deletedRecipes: ownedIds.length, detachedRecipes },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/groups/:id/recipes
 * Agrega una receta existente (activar) al grupo. La receta puede ser
 * propia o de cualquier otro usuario (recetas generales).
 * Cuerpo: { "recipeId": "<id>" }
 */
exports.addRecipe = async (req, res, next) => {
  try {
    const group = await Group.findOne(activeFilter({ _id: req.params.id, owner: req.user._id }));
    if (!group) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });

    const { recipeId } = req.body;
    if (!recipeId) return res.status(400).json({ success: false, message: 'Se requiere el ID de la receta' });

    const recipe = await Recipe.findOne(activeFilter({ _id: recipeId }));
    if (!recipe) return res.status(404).json({ success: false, message: 'Receta no encontrada' });

    if (group.recipes.some((id) => id.toString() === recipe._id.toString())) {
      return res.status(409).json({ success: false, message: 'La receta ya se encuentra en este grupo' });
    }

    // Enlace bidireccional: grupo -> receta y receta -> grupo
    group.recipes.push(recipe._id);
    await group.save();

    recipe.groups = recipe.groups || [];
    if (!recipe.groups.some((id) => id.toString() === group._id.toString())) {
      recipe.groups.push(group._id);
      await recipe.save();
    }

    return res.json({ success: true, message: 'Receta agregada al grupo', data: group });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/groups/:id/recipes/:recipeId
 * Quita una receta del grupo SIN borrar la receta: solo queda fuera del grupo.
 */
exports.removeRecipe = async (req, res, next) => {
  try {
    const group = await Group.findOne(activeFilter({ _id: req.params.id, owner: req.user._id }));
    if (!group) return res.status(404).json({ success: false, message: 'Grupo no encontrado' });

    const { recipeId } = req.params;

    // Desvincula la receta de este grupo
    group.recipes = group.recipes.filter((id) => id.toString() !== recipeId.toString());
    await group.save();

    // Desvincula el grupo de la receta (la receta NO se borra)
    await Recipe.updateOne({ _id: recipeId }, { $pull: { groups: group._id } });

    return res.json({ success: true, message: 'La receta fue quitada del grupo' });
  } catch (err) {
    next(err);
  }
};