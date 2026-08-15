import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import chefRoutes from './routes/chef.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Asegurar que la carpeta 'uploads' existe al arrancar
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middlewares de seguridad y formato
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir la interfaz web estática desde la carpeta 'public'
app.use(express.static(path.join(process.cwd(), 'public')));

// Ruta de Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'chef-ia-app',
    timestamp: new Date().toISOString()
  });
});

// Configurar rutas de la API de IA y Multer
app.use('/api/chef', chefRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 chef-ia-app corriendo en: http://localhost:${PORT}`);
  console.log(`🖥️ Interfaz Web lista en: http://localhost:${PORT}`);
  console.log(`🏥 Healthcheck disponible en: http://localhost:${PORT}/api/health`);
  console.log(`=================================`);
});