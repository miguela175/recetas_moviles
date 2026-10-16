const express = require('express');
const protect = require('../middleware/auth');
const {
  getAll,
  getOne,
  create,
  update,
  remove,
} = require('../controllers/recipeController');

const router = express.Router();

// Todas las rutas de recetas requieren autenticación
router.use(protect);

// GET /api/recipes -> Lista (personales con ?mine=true, grupo con ?group=<id>, búsqueda con ?q=)
router.get('/', getAll);

// POST /api/recipes -> Crear receta
router.post('/', create);

// GET /api/recipes/:id -> Detalle
router.get('/:id', getOne);

// PUT /api/recipes/:id -> Editar receta (solo autor)
router.put('/:id', update);

// DELETE /api/recipes/:id -> Borrar receta (borrado lógico, solo autor)
router.delete('/:id', remove);

module.exports = router;