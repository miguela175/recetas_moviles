const mongoose = require('mongoose');

/**
 * Conexión a MongoDB.
 *
 * Estrategia de conexión:
 *   1. Intenta conectar a la URI de MONGO_URI (por defecto localhost:27017).
 *   2. Si no hay un MongoDB corriendo localmente, levanta un MongoDB en memoria
 *      (mongodb-memory-server) para que el proyecto funcione sin instalaciones.
 *
 * En ambos casos se usa un motor real de MongoDB con soporte de índices, etc.
 */
async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/recetas';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000,
    });
    console.log(`[DB] MongoDB conectado correctamente: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.warn('[DB] No se pudo conectar a MongoDB local. Intentando con MongoDB en memoria...');

    // Fallback: MongoDB en memoria (descarga un binario de mongod la primera vez).
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const memoryServer = await MongoMemoryServer.create();
    const memoryUri = memoryServer.getUri('recetas');

    const conn = await mongoose.connect(memoryUri, { serverSelectionTimeoutMS: 60000 });
    console.log(`[DB] MongoDB en memoria listo en: ${memoryUri}`);
    console.log('[DB] Nota: los datos se pierden al reiniciar el backend.');
    return conn;
  }
}

module.exports = connectDB;