const express = require('express');
const { register, login } = require('../controllers/authController');

const router = express.Router();

// POST /api/auth/register -> Registro de usuario
router.post('/register', register);

// POST /api/auth/login -> Inicio de sesión
router.post('/login', login);

module.exports = router;