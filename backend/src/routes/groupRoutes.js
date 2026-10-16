const express = require('express');
const protect = require('../middleware/auth');
const {
  getAll,
  getOne,
  create,
  update,
  remove,
  addRecipe,
  removeRecipe,
} = require('../controllers/groupController');

const router = express.Router();

// Todas las rutas de grupos requieren autenticación
router.use(protect);

// GET /api/groups -> Grupos del usuario (alfabético)
router.get('/', getAll);

// POST /api/groups -> Crear grupo
router.post('/', create);

// GET /api/groups/:id -> Detalle con recetas
router.get('/:id', getOne);

// PUT /api/groups/:id -> Editar grupo
router.put('/:id', update);

// DELETE /api/groups/:id -> Borrar grupo (cascada sobre recetas propias)
router.delete('/:id', remove);

// POST /api/groups/:id/recipes -> Agregar receta al grupo { recipeId }
router.post('/:id/recipes', addRecipe);

// DELETE /api/groups/:id/recipes/:recipeId -> Quitar receta del grupo (sin borrarla)
router.delete('/:id/recipes/:recipeId', removeRecipe);

module.exports = router;