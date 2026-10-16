/**
 * Inicia un MongoDB local PERSISTENTE en el puerto 27017.
 *
 * Reutiliza el binario de mongod que descarga mongodb-memory-server
 * (ubicado en node_modules/.cache/mongodb-memory-server) para evitar
 * tener que instalar MongoDB por separado.
 *
 * Uso:  npm run mongo
 * Los datos se guardan en la carpeta ./backend/.mongo-data
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '.mongo-data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Busca el ejecutable mongod dentro de la caché de mongodb-memory-server
function findMongod() {
  const base = path.join(__dirname, '..', 'node_modules', '.cache', 'mongodb-memory-server');
  if (!fs.existsSync(base)) return null;
  const entry = fs.readdirSync(base).find((f) => f.startsWith('mongod'));
  return entry ? path.join(base, entry) : null;
}

const mongod = findMongod();
if (!mongod) {
  console.error('No se encontró el binario mongod. Ejecuta primero: npm install');
  process.exit(1);
}

console.log(`[MONGO] Iniciando MongoDB persistente con: ${mongod}`);
console.log(`[MONGO] Datos en: ${dataDir}`);

const child = spawn(mongod, ['--dbpath', dataDir, '--port', '27017', '--bind_ip', '127.0.0.1'], {
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code || 0));