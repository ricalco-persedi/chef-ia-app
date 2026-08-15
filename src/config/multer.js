import multer from 'multer';
import path from 'path';

// Configuración de almacenamiento en disco para procesamiento temporal
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `ingrediente-${uniqueSuffix}${extension}`);
  }
});

// Filtro de seguridad para permitir únicamente imágenes
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato no soportado. Solo se permiten imágenes (JPG, PNG, WEBP, HEIC).'), false);
  }
};

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // Límite máximo de 10 MB por foto
  },
  fileFilter: fileFilter
});