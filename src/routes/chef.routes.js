import { Router } from 'express';
import { upload } from '../config/multer.js';
import { ai, MODEL_CANDIDATES } from '../config/genai.js';
import fs from 'fs';

const router = Router();

async function generateContentWithFallback(contents) {
  let lastError = null;
  for (const modelName of MODEL_CANDIDATES) {
    try {
      console.log(`📡 Invocando modelo con reglas de salud y multifoto: ${modelName}...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
      });
      return { text: response.text, modelUsed: modelName };
    } catch (error) {
      console.warn(`⚠️ Fallo en modelo ${modelName}:`, error.message || error);
      lastError = error;
    }
  }
  throw lastError;
}

// Permite subir hasta 4 imágenes simultáneas
router.post('/analizar-imagen', upload.array('imagenes', 4), async (req, res) => {
  let uploadedPaths = [];

  try {
    const { ubicacion, condicionesSalud, modoCocina, preferenciaTexto, estiloComida, comensales, sorprendeme } = req.body;
    const saludList = condicionesSalud ? JSON.parse(condicionesSalud) : [];

    let contents = [];

    // Procesar múltiples imágenes recibidas
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        uploadedPaths.push(file.path);
        const imageBuffer = fs.readFileSync(file.path);
        contents.push({
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: file.mimetype
          }
        });
      }
    }

    let saludInstructions = saludList.length > 0 
      ? `🚨 RESTRICCIONES MÉDICAS Y ALIMENTARIAS OBLIGATORIAS: ${saludList.join(', ')}. DEBES garantizar que NINGÚN ingrediente o preparación transgreda estas condiciones de salud. Si el usuario tiene diabetes, controla estrictamente los carbohidratos/azúcares; si es celíaco, garantiza 0% gluten.`
      : `Sin restricciones de salud especificadas.`;

    const masterPrompt = `
Eres un Nutricionista Clínico y Executive Chef Profesional.

PARÁMETROS DEL USUARIO:
- Ubicación: ${ubicacion || 'Global'}
- Comensales: ${comensales || 2}
- Estilo: ${estiloComida ? estiloComida.toUpperCase() : 'FAMILIAR'}
- RESTRICCIONES DE SALUD: ${saludInstructions}
- Alimentos descritos/ocultos/antojos: "${preferenciaTexto || 'Ninguno especifico'}"

TAREA:
1. Revisa TODAS las fotografías adjuntas (que muestran distintos estantes, alacenas o productos) y combina la información con el texto/dictado por voz.
2. Crea una receta adaptada estrictamente a las RESTRICCIONES DE SALUD solicitadas.
3. Sugiere 3 a 4 comercios locales económicos en ${ubicacion} para comprar los faltantes.

INSTRUCCIONES DE RESPUESTA EN MARKDOWN:

🩺 ADAPTACIÓN DE SALUD Y NUTRICIÓN:
- Breve resumen de cómo esta receta cumple con: ${saludList.join(', ') || 'Alimentación General'}.

🍳 INGREDIENTES DETECTADOS / DISPONIBLES:
- Lista de ingredientes identificados en las fotos y el dictado.

🛒 LISTA DE COMPRAS SUGERIDA (Para ${comensales} personas):
- Ingredientes requeridos faltantes con nomenclatura de ${ubicacion}.

📍 COMERCIOS RECOMENDADOS EN ${ubicacion.toUpperCase()}:
1. 🏬 **[Mercado/Tienda Local 1]** - *Opción Económica* (Dirección o zona).
2. 🛒 **[Supermercado 2]** - *Variedad de productos especiales*.
3. 🥩 **[Comercio de Cercanía 3]** - *Productos frescos localizados*.

👨‍🍳 RECETA: [Nombre de la Receta]
- Dificultad, tiempo y perfil nutricional clave (ej: Bajo en sodio, Índice Glucémico Bajo).
- Ingredientes y cantidades exactas.

🥣 PASO A PASO SEGURO:
1. Paso 1.
2. Paso 2.
3. Paso 3.

💡 CONSEJO DEL CHEF & ADVERTENCIA NUTRICIONAL:
- Un tip gastronómico junto con una nota sobre la conservación adecuada de los insumos.
`;

    contents.push(masterPrompt);

    const result = await generateContentWithFallback(contents);

    // Limpiar imágenes subidas
    uploadedPaths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });

    return res.json({
      success: true,
      modelUsed: result.modelUsed,
      recetaSugerida: result.text
    });

  } catch (error) {
    uploadedPaths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
    console.error('❌ Error en /analizar-imagen:', error);
    return res.status(500).json({ error: 'Error interno en el servidor.', details: error.message });
  }
});

export default router;