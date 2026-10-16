const express = require('express');
const protect = require('../middleware/auth');
const { getMe, updateMe, deleteMe } = require('../controllers/userController');

const router = express.Router();

// Todas las rutas de usuario requieren autenticación
router.use(protect);

// GET /api/users/me -> Ver perfil
router.get('/me', getMe);

// PUT /api/users/me -> Editar perfil (nombre, email, avatar, contraseña)
router.put('/me', updateMe);

// DELETE /api/users/me -> Borrar cuenta (borrado lógico)
router.delete('/me', deleteMe);

module.exports = router;