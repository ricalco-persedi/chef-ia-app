// src/routes/chef.routes.js
import { Router } from 'express';
import { upload } from '../config/multer.js';
import { ai, MODEL_CANDIDATES } from '../config/genai.js';
import fs from 'fs';

const router = Router();

async function generateContentWithFallback(contents) {
  let lastError = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      console.log(`📡 Invocando modelo de IA con geolocalización: ${modelName}...`);
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

router.post('/analizar-imagen', upload.single('imagen'), async (req, res) => {
  let imagePath = null;

  try {
    const { ubicacion, modoCocina, preferenciaTexto, estiloComida, comensales, sorprendeme } = req.body;
    const isSorprendeme = sorprendeme === 'true';

    let contents = [];
    let contextInstructions = `- UBICACIÓN GEOGRÁFICA DEL USUARIO: "${ubicacion || 'Internacional'}". Adapta los términos de los ingredientes a la jerga y disponibilidad local de esta región.\n`;

    if (req.file) {
      imagePath = req.file.path;
      const imageBuffer = fs.readFileSync(imagePath);
      contents.push({
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: req.file.mimetype
        }
      });
      contextInstructions += `- Analiza la fotografía adjunta.\n`;
    }

    if (modoCocina === 'antojo') {
      contextInstructions += `- Modo Antojo/Planificación: Genera una lista de compras completa adaptada a la región (${ubicacion}).\n`;
    }

    if (preferenciaTexto) {
      contextInstructions += `- Antojo/Preferencia expresada: "${preferenciaTexto}".\n`;
    }

    if (isSorprendeme) {
      contextInstructions += `- MODO SORPRESA ACTIVADO: Sorprende con un plato regional o fusión único.\n`;
    }

    const masterPrompt = `
Eres un Executive Chef Profesional e Experto en Comercio Gastronómico Local.

DATOS DE ENTRADA:
- Ubicación del usuario: ${ubicacion || 'Global'}
- Cantidad de comensales: ${comensales || 2} personas
- Estilo: ${estiloComida ? estiloComida.toUpperCase() : 'FAMILIAR'}
${contextInstructions}

INSTRUCCIONES DE RESPUESTA EN MARKDOWN:

🍳 INGREDIENTES DETECTADOS / BASE LOCAL:
- Lista de ingredientes usando la nomenclatura local de ${ubicacion}.

🛒 LISTA DE COMPRAS PARA ${comensales || 2} PORCIONES:
- Ingredientes requeridos con sus medidas locales exactas.

📍 COMERCIOS RECOMENDADOS PARA COMPRAR EN EN ${ubicacion.toUpperCase()}:
*(Muestra entre 3 y 4 opciones de tiendas, mercados locales o supermercados más económicos según datos de Google Maps/Places)*:
1. 🏬 **[Nombre de Mercado / Verdulería / Carnicería Local 1]** - *Opción Económica Recomendada* (Dirección aproximada / Cómo llegar).
2. 🛒 **[Supermercado o Red Local 2]** - *Variedad y ofertas regionales*.
3. 🥩 **[Mercado Central / Local Especializado 3]** - *Ideal para productos frescos locales*.

👨‍🍳 RECETA SUGERIDA: [Nombre del Plato]
- Tiempo estimado y Dificultad.
- Cantidades exactas para ${comensales || 2} comensales.

🥣 PASO A PASO:
1. Paso 1.
2. Paso 2.
3. Paso 3.

🍷 BEBIDA O MARIDAJE LOCAL RECOMENDADO:
- Bebida típica o maridaje perfecto disponible en la región de ${ubicacion}.

💡 SECRETO DEL CHEF (Tip Profesional):
- El truco del cocinero profesional para este plato.
`;

    contents.push(masterPrompt);

    const result = await generateContentWithFallback(contents);

    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    return res.json({
      success: true,
      filename: req.file ? req.file.filename : null,
      modelUsed: result.modelUsed,
      recetaSugerida: result.text
    });

  } catch (error) {
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    console.error('❌ Error en /analizar-imagen:', error);
    return res.status(500).json({ 
      error: 'Error al procesar la solicitud con geolocalización.',
      details: error.message 
    });
  }
});

export default router;