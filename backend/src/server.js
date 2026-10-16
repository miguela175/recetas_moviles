require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Rutas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const groupRoutes = require('./routes/groupRoutes');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Endpoint de salud (para verificar que la API está viva)
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API de Recetas funcionando', time: new Date().toISOString() });
});

// Montaje de rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/groups', groupRoutes);

// 404 y manejo de errores
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

// Arranca primero la base de datos y luego el servidor HTTP
async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[SERVER] API de recetas corriendo en http://localhost:${PORT}`);
  });
}

start();